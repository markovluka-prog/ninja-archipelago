import SwiftUI
import WebKit

/// Отдаёт файлы игры из бандла по схеме ninjai://app/…  (ES-модули не грузятся с file://, поэтому своя схема).
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    private let web = Bundle.main.resourceURL!.appendingPathComponent("web")
    private let vendor = Bundle.main.resourceURL!.appendingPathComponent("vendor")
    private static let cdn = [
        "https://cdn.jsdelivr.net/npm/three@0.160.0/": "ninjai://app/__vendor/three/",
    ]

    private static let mime: [String: String] = [
        "html": "text/html", "js": "text/javascript", "mjs": "text/javascript", "json": "application/json",
        "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "svg": "image/svg+xml",
        "glb": "model/gltf-binary", "gltf": "model/gltf+json", "mp3": "audio/mpeg", "wav": "audio/wav",
        "ogg": "audio/ogg", "css": "text/css", "txt": "text/plain", "bin": "application/octet-stream",
    ]

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return task.didFailWithError(URLError(.badURL)) }
        var path = url.path.removingPercentEncoding ?? url.path
        if path == "/" || path.isEmpty { path = "/index.html" }
        let file: URL
        if path.hasPrefix("/__vendor/") {
            file = vendor.appendingPathComponent(String(path.dropFirst("/__vendor/".count)))
        } else {
            file = web.appendingPathComponent(String(path.dropFirst()))
        }
        guard file.standardizedFileURL.path.hasPrefix(Bundle.main.resourceURL!.standardizedFileURL.path),
              var data = try? Data(contentsOf: file) else {
            let r = HTTPURLResponse(url: url, statusCode: 404, httpVersion: nil, headerFields: nil)!
            task.didReceive(r); task.didFinish(); return
        }
        let ext = file.pathExtension.lowercased()
        if ext == "html", var s = String(data: data, encoding: .utf8) {   // three.js из CDN → локальная копия (работает без сети)
            for (from, to) in Self.cdn { s = s.replacingOccurrences(of: from, with: to) }
            data = Data(s.utf8)
        }
        let headers = ["Content-Type": (Self.mime[ext] ?? "application/octet-stream") + (ext == "html" || ext == "js" ? "; charset=utf-8" : ""),
                       "Content-Length": String(data.count), "Access-Control-Allow-Origin": "*"]
        task.didReceive(HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers)!)
        task.didReceive(data); task.didFinish()
    }
    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}

struct GameView: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let cfg = WKWebViewConfiguration()
        cfg.setURLSchemeHandler(BundleSchemeHandler(), forURLScheme: "ninjai")
        cfg.allowsInlineMediaPlayback = true
        cfg.mediaTypesRequiringUserActionForPlayback = []
        let wv = WKWebView(frame: .zero, configuration: cfg)
        wv.scrollView.isScrollEnabled = false
        wv.scrollView.bounces = false
        wv.scrollView.contentInsetAdjustmentBehavior = .never
        wv.allowsBackForwardNavigationGestures = false
        wv.isOpaque = false; wv.backgroundColor = .black
        if #available(iOS 16.4, *) { wv.isInspectable = true }
        // rt=1 — мультиплеер через Supabase Realtime (локального сервера в приложении нет)
        wv.load(URLRequest(url: URL(string: "ninjai://app/index.html?rt=1")!))
        return wv
    }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
