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
