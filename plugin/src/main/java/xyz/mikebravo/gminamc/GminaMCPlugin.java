package xyz.mikebravo.gminamc;

import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.plugin.java.JavaPlugin;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.StringJoiner;

/**
 * Gmina MC reporter plugin.
 *
 * Pushes the online roster to the Gmina MC backend so the iOS/Watch app gets
 * accurate, low-latency presence (exact join/quit times, real UUIDs, the full
 * player list — not the ~12 capped sample that Server List Ping exposes).
 *
 * All HTTP runs off the main server thread.
 */
public final class GminaMCPlugin extends JavaPlugin implements Listener {

    private final HttpClient http =
            HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    private String backendUrl;
    private String ingestToken;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        backendUrl = stripTrailingSlash(getConfig().getString("backend-url", ""));
        ingestToken = getConfig().getString("ingest-token", "");
        long heartbeatSeconds = Math.max(5, getConfig().getLong("heartbeat-seconds", 20));

        if (backendUrl.isEmpty() || ingestToken.isEmpty()) {
            getLogger().warning(
                    "backend-url / ingest-token not configured in config.yml — plugin is idle.");
            return;
        }

        getServer().getPluginManager().registerEvents(this, this);

        long ticks = heartbeatSeconds * 20L;
        Bukkit.getScheduler().runTaskTimerAsynchronously(this, this::sendHeartbeat, 20L, ticks);

        getLogger().info("Gmina MC reporting to " + backendUrl
                + " every " + heartbeatSeconds + "s");
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        sendEventAsync("join", event.getPlayer());
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        sendEventAsync("quit", event.getPlayer());
    }

    /** Authoritative snapshot of everyone currently online. */
    private void sendHeartbeat() {
        StringJoiner players = new StringJoiner(",", "[", "]");
        for (Player p : Bukkit.getOnlinePlayers()) {
            players.add("{\"uuid\":\"" + p.getUniqueId()
                    + "\",\"name\":\"" + escape(p.getName()) + "\"}");
        }
        post("/api/ingest/heartbeat", "{\"players\":" + players + "}");
    }

    /** Instant single event so push arrives within ~1s instead of a heartbeat. */
    private void sendEventAsync(String type, Player player) {
        final String uuid = player.getUniqueId().toString();
        final String name = player.getName();
        Bukkit.getScheduler().runTaskAsynchronously(this, () ->
                post("/api/ingest/event",
                        "{\"type\":\"" + type + "\",\"uuid\":\"" + uuid
                                + "\",\"name\":\"" + escape(name) + "\"}"));
    }

    private void post(String path, String body) {
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(backendUrl + path))
                    .timeout(Duration.ofSeconds(8))
                    .header("Authorization", "Bearer " + ingestToken)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<Void> response = http.send(request, HttpResponse.BodyHandlers.discarding());
            if (response.statusCode() >= 300) {
                getLogger().warning("Backend returned " + response.statusCode() + " for " + path);
            }
        } catch (Exception ex) {
            getLogger().warning("Could not reach backend: " + ex.getMessage());
        }
    }

    private static String stripTrailingSlash(String url) {
        String u = url == null ? "" : url.trim();
        while (u.endsWith("/")) u = u.substring(0, u.length() - 1);
        return u;
    }

    /** Minimal JSON string escaping (player names can contain unusual chars via Geyser). */
    private static String escape(String s) {
        StringBuilder out = new StringBuilder(s.length() + 2);
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"' -> out.append("\\\"");
                case '\\' -> out.append("\\\\");
                case '\n' -> out.append("\\n");
                case '\r' -> out.append("\\r");
                case '\t' -> out.append("\\t");
                default -> {
                    if (c < 0x20) out.append(String.format("\\u%04x", (int) c));
                    else out.append(c);
                }
            }
        }
        return out.toString();
    }
}
