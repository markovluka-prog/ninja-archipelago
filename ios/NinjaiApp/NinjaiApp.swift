import SwiftUI

@main
struct NinjaiApp: App {
    var body: some Scene {
        WindowGroup {
            GameView().ignoresSafeArea().statusBarHidden(true).persistentSystemOverlays(.hidden)
        }
    }
}
