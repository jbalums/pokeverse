// Desktop shell for Verdant Town 3D. The game stays a web page (prototypes/verdant-town-3d.html); its assets are ~8 GB,
// far too big to embed in the executable, so they are served from disk through a custom `game` protocol instead.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use percent_encoding::percent_decode_str;
use std::{
    fs,
    path::{Path, PathBuf},
};
use tauri::{
    http::{header::CONTENT_TYPE, Response, StatusCode},
    WebviewUrl, WebviewWindowBuilder,
};

const PAGE: &str = "verdant-town-3d.html";
// WebView2 (Windows) and Android expose custom protocols as http://<scheme>.localhost
#[cfg(any(windows, target_os = "android"))]
const START_URL: &str = "http://game.localhost/verdant-town-3d.html";
#[cfg(not(any(windows, target_os = "android")))]
const START_URL: &str = "game://localhost/verdant-town-3d.html";

/// The folder holding the game page: $VERDANT_ROOT, else the first `prototypes/` (or the folder itself) found walking up
/// from the executable (an exe beside `prototypes/`, or inside the repo), else the repo this binary was built from.
fn game_root() -> Option<PathBuf> {
    if let Some(p) = std::env::var_os("VERDANT_ROOT") {
        return PathBuf::from(p).canonicalize().ok();
    }
    let exe = std::env::current_exe().ok()?;
    exe.ancestors()
        .flat_map(|dir| [dir.join("prototypes"), dir.to_path_buf()])
        .chain([Path::new(env!("CARGO_MANIFEST_DIR")).join("../prototypes")]) // builds kept outside the repo (CARGO_TARGET_DIR)
        .find(|dir| dir.join(PAGE).is_file())?
        .canonicalize()
        .ok()
}

fn mime(path: &Path) -> &'static str {
    match path.extension().and_then(|e| e.to_str()).map(str::to_ascii_lowercase).as_deref() {
        Some("html" | "htm") => "text/html; charset=utf-8",
        Some("js" | "mjs") => "text/javascript; charset=utf-8",
        Some("json") => "application/json",
        Some("css") => "text/css",
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("svg") => "image/svg+xml",
        Some("dae") => "model/vnd.collada+xml",
        Some("obj" | "mtl" | "txt") => "text/plain; charset=utf-8",
        Some("m4a" | "mp4") => "audio/mp4",
        Some("mp3") => "audio/mpeg",
        Some("ogg") => "audio/ogg",
        Some("wav") => "audio/wav",
        Some("woff2") => "font/woff2",
        _ => "application/octet-stream",
    }
}

fn reply(status: StatusCode, kind: &str, body: Vec<u8>) -> Response<Vec<u8>> {
    Response::builder().status(status).header(CONTENT_TYPE, kind).body(body).unwrap()
}

/// Serves one file under `root`; anything that resolves outside it (`..`, links) is a 404.
fn serve(root: Option<&Path>, url_path: &str) -> Response<Vec<u8>> {
    let Some(root) = root else {
        let msg = format!("Verdant Town can't find its game files: put this app next to the `prototypes` folder (holding {PAGE}), or set VERDANT_ROOT.");
        return reply(StatusCode::NOT_FOUND, "text/plain; charset=utf-8", msg.into_bytes());
    };
    let rel = percent_decode_str(url_path.trim_start_matches('/')).decode_utf8_lossy();
    let file = root.join(if rel.is_empty() { PAGE } else { &*rel });
    match file.canonicalize() {
        Ok(f) if f.starts_with(root) && f.is_file() => match fs::read(&f) {
            Ok(bytes) => reply(StatusCode::OK, mime(&f), bytes),
            Err(_) => reply(StatusCode::INTERNAL_SERVER_ERROR, "text/plain", Vec::new()),
        },
        _ => reply(StatusCode::NOT_FOUND, "text/plain", Vec::new()),
    }
}

fn main() {
    let root = game_root();
    tauri::Builder::default()
        // async: the game requests hundreds of models at start, which must not stall the window's event loop
        .register_asynchronous_uri_scheme_protocol("game", move |_ctx, request, responder| {
            let (root, path) = (root.clone(), request.uri().path().to_owned());
            std::thread::spawn(move || responder.respond(serve(root.as_deref(), &path)));
        })
        .setup(|app| {
            let handle = app.handle().clone();
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(START_URL.parse()?))
                // the page's Quit Game navigates here (no IPC needed, so the page gets no Tauri API surface)
                .on_navigation(move |url| {
                    if url.path() == "/__quit" {
                        handle.exit(0);
                        return false;
                    }
                    true
                })
                .title("Verdant Town")
                .inner_size(1280.0, 800.0)
                .min_inner_size(800.0, 500.0)
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Verdant Town");
}
