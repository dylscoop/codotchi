package com.gotchi

import com.intellij.ide.AppLifecycleListener
import com.intellij.openapi.components.service

/**
 * GotchiAppLifecycleListener — forces [GotchiPlugin] to initialise as soon
 * as the IDE finishes starting up.
 *
 * Without this, the plugin service would not be created until the tool window
 * is first opened, which means the tick scheduler would not run and no offline
 * decay would be applied on first launch.
 */
class GotchiAppLifecycleListener : AppLifecycleListener {

    override fun appStarted() {
        // Accessing the service triggers lazy initialisation; GotchiPlugin.initialize()
        // is called from its init block, which starts the tick loop and loads saved state.
        service<GotchiPlugin>().initialize()
    }
}
