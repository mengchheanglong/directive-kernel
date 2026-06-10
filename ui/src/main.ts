import "./styles.css";

function renderBootFailure(mount: Element, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const section = document.createElement("section");
  section.style.cssText = [
    "min-height:100vh",
    "padding:32px",
    "background:#171717",
    "color:#fafafa",
    "font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
  ].join(";");

  const title = document.createElement("h1");
  title.textContent = "Directive UI failed to start";
  title.style.cssText = "margin:0 0 12px;font-size:20px";

  const body = document.createElement("p");
  body.textContent = "A frontend module failed before the app shell could mount.";
  body.style.cssText = "max-width:720px;color:#d4d4d4";

  const detail = document.createElement("pre");
  detail.textContent = message;
  detail.style.cssText = [
    "max-width:960px",
    "overflow:auto",
    "margin-top:18px",
    "padding:14px",
    "background:#262626",
    "border:1px solid #404040",
  ].join(";");

  section.append(title, body, detail);
  mount.replaceChildren(section);
}

async function boot() {
  const mount = document.querySelector("#app");
  if (!mount) {
    return;
  }

  try {
    await import("./pages/app-shell");
    mount.replaceChildren(document.createElement("directive-ui-app"));
  } catch (error) {
    renderBootFailure(mount, error);
    throw error;
  }
}

void boot();
