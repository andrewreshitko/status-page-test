let express = require("express");
const { allowDevAllOrigin } = require("../util-server");
const { subscribeRateLimiter } = require("../rate-limiter");
const StatusPageSubscriber = require("../model/status_page_subscriber");
const GroupLogEntry = require("../model/group_log_entry");
const apicache = require("../modules/apicache");
const { log } = require("../../src/util");

let router = express.Router();
let cache = apicache.middleware;

/**
 * Render a minimal, self-contained HTML confirmation/error page, styled as
 * a clear success/error notification since it's the only feedback a
 * subscriber sees when they click a link from an email.
 * @param {string} title Page title / heading
 * @param {string} message Body message
 * @param {string} status "success" or "error" - controls the banner color/icon
 * @returns {string} HTML document
 */
function simplePage(title, message, status = "success") {
    const color = status === "error" ? "#dc3545" : "#059669";
    const icon = status === "error" ? "&times;" : "&#10003;";

    return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family: sans-serif; max-width: 32rem; margin: 4rem auto; text-align: center; padding: 0 1rem;">
<div style="width: 64px; height: 64px; line-height: 64px; border-radius: 50%; background: ${color}; color: #fff; font-size: 32px; margin: 0 auto 1.5rem;">${icon}</div>
<h1 style="margin-bottom: 0.5rem;">${title}</h1>
<p style="color: #555;">${message}</p>
</body>
</html>`;
}

// In dev, the frontend (port 3000) and backend (port 3001) are different
// origins, so a POST with a JSON body triggers a CORS preflight. Express
// auto-responds to OPTIONS for a path that only has other methods
// registered, but without any CORS headers - explicitly handle it so the
// browser will actually allow the real request through.
router.options("/api/status-page/group/:groupId/subscribe", (request, response) => {
    allowDevAllOrigin(response);
    response.end();
});

router.options("/api/status-page/subscription/unsubscribe", (request, response) => {
    allowDevAllOrigin(response);
    response.end();
});

// Public: subscribe an email to a group's notifications.
// Always responds the same way regardless of outcome, so the response
// itself can never be used to enumerate emails/groups or distinguish
// invalid input from an already-subscribed address.
router.post("/api/status-page/group/:groupId/subscribe", async (request, response) => {
    allowDevAllOrigin(response);

    try {
        const allowed = await subscribeRateLimiter.pass(null);
        if (allowed) {
            const groupId = parseInt(request.params.groupId, 10);
            if (Number.isInteger(groupId)) {
                await StatusPageSubscriber.subscribe(groupId, request.body?.email);
            }
        } else {
            log.debug("subscription", "Subscribe request rate-limited");
        }
    } catch (error) {
        log.debug("subscription", "Subscribe request failed: " + error.message);
    }

    response.json({
        ok: true,
        msg: "If the email address is valid, a confirmation link has been sent.",
    });
});

// Public: confirm a subscription via the emailed token.
router.get("/api/status-page/subscription/confirm", async (request, response) => {
    try {
        await StatusPageSubscriber.confirm(request.query.token);
        response
            .type("html")
            .send(
                simplePage(
                    "Subscribed",
                    "You're subscribed! A confirmation email is on its way. You can close this page.",
                    "success"
                )
            );
    } catch (error) {
        response
            .status(400)
            .type("html")
            .send(
                simplePage(
                    "Invalid link",
                    "This confirmation link is invalid or has already been used.",
                    "error"
                )
            );
    }
});

// Public: manual unsubscribe click from an email.
router.get("/api/status-page/subscription/unsubscribe", async (request, response) => {
    await StatusPageSubscriber.unsubscribe(request.query.token);
    response.type("html").send(simplePage("Unsubscribed", "You have been unsubscribed.", "success"));
});

// Public: RFC 8058 one-click unsubscribe, used by mail clients' native
// "Unsubscribe" button (List-Unsubscribe-Post header). No page to render.
router.post("/api/status-page/subscription/unsubscribe", async (request, response) => {
    // The token lives in the URL itself (from the List-Unsubscribe header);
    // mail clients POST "List-Unsubscribe=One-Click" as the body, not the token.
    const token = request.query.token || request.body?.token;
    await StatusPageSubscriber.unsubscribe(token);
    response.status(200).end();
});

// Public: a group's maintenance/incident log, most recent first.
// A plain GET with no custom headers never triggers a CORS preflight, so no
// router.options() handler is needed here (unlike the POST endpoints above).
router.get("/api/status-page/group/:groupId/log", cache("5 minutes"), async (request, response) => {
    allowDevAllOrigin(response);

    const groupId = parseInt(request.params.groupId, 10);
    const entries = Number.isInteger(groupId) ? await GroupLogEntry.listPublicByGroup(groupId) : [];

    response.json({
        ok: true,
        entries,
    });
});

module.exports = router;
