const notice = document.querySelector("#notice");
function show(s) {
  notice.textContent = s;
  notice.hidden = false;
  notice.classList.add("error");
}
const params = new URLSearchParams(location.search);
if (params.get("error")) show(params.get("error"));
fetch("/api/config")
  .then((r) => r.json())
  .then((c) => {
    document.querySelector("#discord").hidden = !c.discordOAuth;
    document.querySelector("#discordHint").hidden = c.discordOAuth;
  })
  .catch(() => show("No se pudo consultar el servidor."));
fetch("/api/auth/me")
  .then((r) => {
    if (r.ok) location.href = "/v2/police";
  })
  .catch(() => {});
document.querySelector("#login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const button = e.target.querySelector("button");
  button.disabled = true;
  try {
    const r = await fetch("/api/local/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Local-Request": "1" },
      body: JSON.stringify(Object.fromEntries(new FormData(e.target))),
    });
    const data = await r.json();
    if (!r.ok) throw Error(data.message);
    location.href = "/v2/police";
  } catch (err) {
    show(err.message);
  } finally {
    button.disabled = false;
  }
});
