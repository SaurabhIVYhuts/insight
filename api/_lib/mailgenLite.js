// Drop-in replacement for the subset of Mailgen this app uses
// (body.name / intro / table.data / action.button / outro).
//
// Why: Mailgen renders through EJS, which compiles templates with
// `new Function()` — and Cloudflare Workers forbid code generation from
// strings, so Mailgen cannot even load there. This renders the same
// structure with plain string templates (no eval), with HTML escaping.
const esc = (v) =>
    String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
const list = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);

class MailgenLite {
    constructor({ product }) {
        this.product = product || { name: "", link: "" };
    }

    generate({ body = {} }) {
        const { name, intro, table, action, outro } = body;
        const rows = (table && table.data) || [];
        const cols = rows.length ? Object.keys(rows[0]) : [];
        const p = (t) => `<p style="margin:0 0 14px;line-height:1.55">${esc(t)}</p>`;
        const html = [
            `<!doctype html><html><body style="margin:0;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif;color:#51545e">`,
            `<div style="max-width:600px;margin:0 auto;padding:24px"><div style="background:#fff;border-radius:8px;padding:32px">`,
            `<h1 style="margin:0 0 18px;font-size:20px;color:#333">${esc(this.product.name)}</h1>`,
            `<p style="margin:0 0 14px;font-size:16px;color:#333">Hi ${esc(name || "there")},</p>`,
            ...list(intro).map(p),
            rows.length
                ? `<table style="width:100%;border-collapse:collapse;margin:18px 0"><thead><tr>${cols
                      .map((c) => `<th align="left" style="padding:8px;border-bottom:1px solid #eaeaec;font-size:13px;color:#85878e">${esc(c)}</th>`)
                      .join("")}</tr></thead><tbody>${rows
                      .map((r) => `<tr>${cols.map((c) => `<td style="padding:8px;border-bottom:1px solid #eaeaec;font-size:14px">${esc(r[c])}</td>`).join("")}</tr>`)
                      .join("")}</tbody></table>`
                : "",
            action && action.button
                ? `${action.instructions ? p(action.instructions) : ""}<p style="margin:18px 0"><a href="${esc(action.button.link)}" style="display:inline-block;padding:10px 20px;border-radius:4px;background:${esc(
                      action.button.color || "#4f7cff"
                  )};color:#fff;text-decoration:none">${esc(action.button.text)}</a></p>`
                : "",
            ...list(outro).map(p),
            `<p style="margin:18px 0 0">Thanks,<br>${esc(this.product.name)}</p>`,
            `</div><p style="text-align:center;font-size:12px;color:#a8aaaf">&copy; ${new Date().getFullYear()} ${esc(this.product.name)}. All rights reserved.</p></div></body></html>`,
        ];
        return html.join("");
    }

    generatePlaintext({ body = {} }) {
        const { name, intro, table, action, outro } = body;
        const rows = (table && table.data) || [];
        const lines = [`Hi ${name || "there"},`, "", ...list(intro), ""];
        rows.forEach((r) => lines.push(Object.values(r).map((v) => String(v ?? "")).join(": ")));
        if (rows.length) lines.push("");
        if (action && action.button) lines.push(...(action.instructions ? [action.instructions] : []), `${action.button.text}: ${action.button.link}`, "");
        lines.push(...list(outro), "", "Thanks,", this.product.name);
        return lines.join("\n");
    }
}

module.exports = MailgenLite;
