export default function collapsablePosts() {

  let style = document.createElement("style");
  style.innerHTML = `
  .yal-collapsible.yal-collapsed > *:not(header) {
    display: none;
  }
  .yal-collapsible.yal-collapsed > header {
    min-height: 100%;
  }
  `;
  document.body.appendChild(style);
  //
  setInterval(() => {
    for (let post of document.querySelectorAll(`div.renderIfVisible article:not(.yal-collapsible)`)) {
      post.classList.add("yal-collapsible");
      let header = post.querySelector("header");
      let headerDiv = header.querySelector("div");
      header.addEventListener("click", (e) => {
        if (e.target != header && e.target != headerDiv) return;
        post.classList.toggle("yal-collapsed");
      });
    }
  }, 500);

}