// original authors:
// meadow @wowperfect, mint @mintexists, eas @easrng
// with thanks to @nex3, @cfrqn
import React from 'react'
import ReactDOM from 'react-dom/client'

export default async function hideSharesToggle() {

  if (
    !(
      window.location.href.endsWith('cohost.org/rc/dashboard/')
      || window.location.href.endsWith('cohost.org/rc/dashboard')
      || window.location.href.endsWith('cohost.org/')
      || window.location.href.endsWith('cohost.org')
    )
  ) return

  function markShare(thread) {
    const pageHandleQuery = 'header a.co-project-handle'
    const handles = [...thread.querySelectorAll(pageHandleQuery)].map(x => x.href)

    if (handles.length > 1 && handles[0] !== handles[1]) {
      thread.parentNode.classList.add('-remove-shares--is-share')
    }
  }

  const parent = document.querySelector('main section > div:nth-child(1)')
  const rootDiv = document.createElement('span')
  rootDiv.id = 'hide-shares-toggle--root'
  rootDiv.classList = ['pl-4']
  parent.appendChild(rootDiv)
  const root = ReactDOM.createRoot(rootDiv)

  const render = new Promise((resolve, reject) => {
    root.render(
      <>
        <input
          type='checkbox'
          ref={resolve}
          id='-remove-shares--checkbox-toggle'
          className='h-6 w-6 rounded-lg border-2 border-foreground bg-notWhite text-foreground focus:ring-foreground pl-4'
        ></input>
        <label
          htmlFor='-remove-shares--checkbox-toggle'
          className='font-bold pl-2 pr-2 text-sidebarText'
        >
          hide shares
        </label>
      </>
    )
  })

  await render

  const checkbox = document.getElementById('-remove-shares--checkbox-toggle')
  checkbox.addEventListener("change", () => {
    document.querySelector('#live-dashboard').classList.toggle('-remove-shares--hide-shares')
  })

  const feed = document.querySelector('#live-dashboard > div:nth-child(2)')
  for (const post of feed.querySelectorAll('[data-view=post-preview]')) {
    markShare(post)
  }

  const observer = new MutationObserver(mutations => {
    // const parent = document.querySelector('#live-dashboard > div:nth-child(1)')
    // if (parent && ![...parent.children].includes(label)) {
    //   parent.appendChild(label)
    // }
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.dataset.view === 'post-preview') {
          markShare(node);
        } else {
          for (const thread of
            node.querySelectorAll('[data-view=post-preview]')) {
            markShare(thread);
          }
        }
      }
    }
  })

  observer.observe(document.body, { subtree: true, childList: true });
}