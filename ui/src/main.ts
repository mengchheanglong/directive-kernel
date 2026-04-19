import "./styles.css";
import "./pages/app-shell";

const mount = document.querySelector("#app");
if (mount) {
  mount.append(document.createElement("directive-ui-app"));
}
