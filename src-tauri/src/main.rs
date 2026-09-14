// release 构建下不额外弹出控制台窗口
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    gpt_image_playground_lib::run()
}
