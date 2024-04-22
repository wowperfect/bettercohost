import * as defaults from './defaults.json'
import strings from './strings'
import hideSharesToggle from './hide-shares-toggle'
import collapsablePosts from './minimizable-posts'

const getTweak = tweak =>
  JSON.parse(localStorage.getItem('tweaks.' + tweak)) ?? defaults[tweak]

export default function initializeTweaks() {

  if (getTweak(strings.collapsablePosts)) {
    collapsablePosts()
  }

  if (getTweak(strings.hideSharesToggle)) {
    hideSharesToggle()
  }

  if (getTweak(strings.hideChorner)) {
    import('./styles/hide-chorner.css')
  }

  if (getTweak(strings.compactView)) {
    import('./styles/compact-view.css')
  }

  if (getTweak(strings.widerFeed)) {
    import('./styles/wider-feed.css')
  }

  if (getTweak(strings.compactComments)) {
    import('./styles/compact-comments.css')
  }

}
