package com.codotchi

import com.intellij.openapi.components.service
import com.intellij.openapi.editor.Document
import com.intellij.openapi.fileEditor.FileDocumentManagerListener

/**
 * CodotchiEventsManager — listens for document-save events and notifies
 * [CodotchiPlugin] to apply the code-activity happiness boost.
 *
 * Registered as a project-level listener in plugin.xml on the
 * [FileDocumentManagerListener] topic.
 *
 * Throttling (CODE_ACTIVITY_THROTTLE_SECONDS) is enforced inside
 * [CodotchiPlugin.triggerCodeActivity].
 */
class CodotchiEventsManager : FileDocumentManagerListener {

    override fun beforeDocumentSaving(document: Document) {
        service<CodotchiPlugin>().triggerCodeActivity()
    }
}
