import "./styles.css";
import "./app";

const mount = document.querySelector("#app");
if (mount) {
  mount.append(document.createElement("directive-frontend-app"));
}
