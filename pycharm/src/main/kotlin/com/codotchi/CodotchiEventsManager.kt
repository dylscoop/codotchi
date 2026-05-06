package com.codotchi

import com.intellij.openapi.components.service
import com.intellij.openapi.editor.Document
import com.intellij.openapi.fileEditor.FileDocumentManagerListener

/**
 * CodotchiEventsManager — listens for IDE-initiated document-save events and
 * notifies [CodotchiPlugin] to apply the code-activity happiness boost.
 *
 * Registered as a project-level listener in plugin.xml on the
 * [FileDocumentManagerListener] topic.  This covers saves made via Ctrl+S,
 * auto-save, and extension/plugin calls to save a document — i.e. cases where
 * the IDE owns the document buffer.
 *
 * External saves (terminal vim/nano, AI agents writing files directly to disk)
 * are detected separately via the VFS BulkFileListener subscribed in
 * [CodotchiPlugin.initialize], which fires when IntelliJ's VFS refresh picks
 * up filesystem changes.
 *
 * Throttling (CODE_ACTIVITY_THROTTLE_SECONDS) is enforced inside
 * [CodotchiPlugin.triggerCodeActivity]; both code paths share the same
 * throttle so duplicate fires are harmless.
 */
class CodotchiEventsManager : FileDocumentManagerListener {

    override fun beforeDocumentSaving(document: Document) {
        service<CodotchiPlugin>().triggerCodeActivity()
    }
}
