// GPT Image Playground 的 Tauri 桌面外壳。
//
// 壳本身不承载业务逻辑：前端仍是上游的纯前端应用（见 ../_source），
// 这里只负责注册桌面能力插件，弥补 WebView 相比浏览器的短板。
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // 用系统默认浏览器打开外部链接，避免把应用自身导航走
        .plugin(tauri_plugin_opener::init())
        // 保存图片 / 导出备份时的原生对话框
        .plugin(tauri_plugin_dialog::init())
        // 与对话框配合，把数据写入用户选定的路径
        .plugin(tauri_plugin_fs::init())
        // 关键插件：请求由 Rust 侧发出，绕开 WebView 的 CORS 限制，
        // 使「纯前端直连各家 API」在桌面端不再受跨域约束。
        .plugin(tauri_plugin_http::init())
        // 记住窗口尺寸与位置
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_title("GPT Image Playground");
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("运行 Tauri 应用失败");
}
