import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var store: ServerStore
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("Backend") {
                    TextField("https://gmina-mc.fly.dev", text: $store.baseURL)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.URL)
                        .autocorrectionDisabled()
                    SecureField("Token API (opcjonalnie)", text: $store.apiToken)
                }
                Section {
                    Button("Odśwież teraz") { Task { await store.refresh() } }
                } footer: {
                    Text("Adres usługi statusów (np. z Fly.io). Token wpisz tylko jeśli ustawiłeś API_TOKEN na serwerze.")
                }
            }
            .navigationTitle("Ustawienia")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Gotowe") { store.startAutoRefresh(); dismiss() }
                }
            }
        }
    }
}
