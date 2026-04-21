package com.codotchi

import com.intellij.ide.AppLifecycleListener
import com.intellij.openapi.components.service

/**
 * CodotchiAppLifecycleListener — forces [CodotchiPlugin] to initialise as soon
 * as the IDE finishes starting up.
 *
 * Without this, the plugin service would not be created until the tool window
 * is first opened, which means the tick scheduler would not run and no offline
 * decay would be applied on first launch.
 */
class CodotchiAppLifecycleListener : AppLifecycleListener {

    override fun appStarted() {
        // Migrate state file from old gotchi/ folder to codotchi/ on first run.
        service<CodotchiPersistence>().migrateStateFolder()
        // Accessing the service triggers lazy initialisation; CodotchiPlugin.initialize()
        // is called from its init block, which starts the tick loop and loads saved state.
        service<CodotchiPlugin>().initialize()
    }
}
