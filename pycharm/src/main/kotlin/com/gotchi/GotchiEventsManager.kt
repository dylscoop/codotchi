package com.gotchi

import com.intellij.openapi.components.service
import com.intellij.openapi.editor.Document
import com.intellij.openapi.fileEditor.FileDocumentManagerListener

/**
 * GotchiEventsManager — listens for document-save events and notifies
 * [GotchiPlugin] to apply the code-activity happiness boost.
 *
 * Registered as a project-level listener in plugin.xml on the
 * [FileDocumentManagerListener] topic.
 *
 * Throttling (CODE_ACTIVITY_THROTTLE_SECONDS) is enforced inside
 * [GotchiPlugin.triggerCodeActivity].
 */
class GotchiEventsManager : FileDocumentManagerListener {

    override fun beforeDocumentSaving(document: Document) {
        service<GotchiPlugin>().triggerCodeActivity()
    }
}
