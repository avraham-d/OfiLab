<?php
/*
 * Optional AI assistant.
 *
 * Copy this file to ai-config.php (it is ignored by git) and set the path of your own
 * server endpoint. The page sends chat requests to it with fetch(..., {mode: 'same-origin'}),
 * so it must be on the same origin as the site, e.g. '/api/ofilab-chat.php'.
 *
 * Never put API keys here or anywhere in the site's files: keep them on the server, in
 * environment variables read by your endpoint. Without ai-config.php every AI control
 * is hidden and nothing is sent anywhere.
 *
 * Request: POST, JSON, header "X-AI-Gateway-Request: 1",
 *   {task: 'personality.chat', message, history: [{role, content}], ...context of the question or results}
 * Response, either:
 *   - JSON {ok: true, answer: "..."}; on failure {ok: false, message: "..."} with a 4xx/5xx status, or
 *   - Server-Sent Events (Content-Type: text/event-stream): "delta" events {text}, then a final
 *     "done" event {ok: true, answer}; an "error" event {message} ends the answer with that message.
 * The answer is rendered as Markdown into DOM nodes (no HTML is executed). Check the request's
 * Origin / Sec-Fetch-Site on the server and enforce your own rate limits and budgets.
 */
return ['endpoint' => '/api/ofilab-chat.php'];
