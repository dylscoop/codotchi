package com.codotchi

import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.ProjectActivity
import java.util.concurrent.atomic.AtomicBoolean

/**
 * CodotchiStartupActivity — forces [CodotchiPlugin] to initialise as soon as the
 * first project finishes opening.
 *
 * Replaces the former CodotchiAppLifecycleListener, which used the internal
 * AppLifecycleListener.appStarted() API. [ProjectActivity] is the modern,
 * non-internal way to run startup logic. The pet's UI (tool window + status bar)
 * only exists inside a project frame, so initialising on first project open is
 * equivalent to initialising at app start for all user-visible purposes.
 *
 * The [initialised] guard ensures the migration and initialisation run exactly
 * once, even though [execute] fires once per opened project.
 */
class CodotchiStartupActivity : ProjectActivity {

    private companion object {
        val initialised = AtomicBoolean(false)
    }

    override suspend fun execute(project: Project) {
        if (!initialised.compareAndSet(false, true)) return
        // Migrate state file from old gotchi/ folder to codotchi/ on first run.
        service<CodotchiPersistence>().migrateStateFolder()
        // Accessing the service triggers lazy initialisation; CodotchiPlugin.initialize()
        // is called from its init block, which starts the tick loop and loads saved state.
        service<CodotchiPlugin>().initialize()
    }
}
