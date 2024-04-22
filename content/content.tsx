import React from 'react'
import ReactDOM from 'react-dom/client'
import ContentApp from './ContentApp'
import initializeTweaks from './tweaks/tweaks'
import('./base.css')
import('./content.css')

function initial() {
  // Create a new div element and append it to the document's body
  const rootDiv = document.createElement('div')
  rootDiv.id = 'extension-root'
  document.querySelector('ul[role="menu"]')?.appendChild(rootDiv)

  // Use `createRoot` to create a root, then render the <App /> component
  // Note that `createRoot` takes the container DOM node, not the React element
  const root = ReactDOM.createRoot(rootDiv)
  root.render(<ContentApp />)

  initializeTweaks()
}

initial()

