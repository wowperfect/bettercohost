import React, { useEffect, useState, useSyncExternalStore } from 'react'
import { useLocalStorage } from 'react-storage-complete';
import Dialog from "./Dialog";
import * as defaults from './tweaks/defaults.json'
import strings from './tweaks/strings';

function useTweak(name) {
  return useLocalStorage(name, defaults[name], { prefix: 'tweaks' })
}

const Checkbox = ({checked, id, onChange}) =>
  <input
    type="checkbox"
    checked={checked}
    id={id}
    className='h-6 w-6 rounded-lg border-2 border-foreground bg-notWhite text-foreground focus:ring-foreground'
    onChange={onChange}
  ></input>

export default function SettingsDialog ({isDialogOpen, setIsDialogOpen}) {

  const [collapsablePosts, setCollapsablePosts] = useTweak(strings.collapsablePosts)
  const [hideSharesToggle, setHideSharesToggle] = useTweak(strings.hideSharesToggle)
  const [hideChorner, setHideChorner] = useTweak(strings.hideChorner)
  const [compactView, setCompactView] = useTweak(strings.compactView)
  const [widerFeed, setWiderFeed] = useTweak(strings.widerFeed)
  const [compactComments, setCompactComments] = useTweak(strings.compactComments)

  return (
    <Dialog openModal={isDialogOpen} closeModal={() => setIsDialogOpen(false)}>
      <h1>function tweaks</h1>
      <div className='p-2'>
        <Checkbox
          checked={collapsablePosts}
          id="bch-collapsablePosts"
          onChange={() => setCollapsablePosts(!collapsablePosts)}
        />
        <label htmlFor="bch-collapsablePosts" className='p-2'>click post headers to minimize the post</label>
      </div>
      <div className='p-2'>
        <Checkbox
          checked={hideSharesToggle}
          id="bch-hideSharesToggle"
          onChange={() => setHideSharesToggle(!hideSharesToggle)}
        />
        <label htmlFor="bch-hideSharesToggle" className='p-2'>adds a toggle at the top of your feed that hides shares</label>
      </div>
      <br/>
      <h1>style tweaks</h1>
      <div className='p-2'>
        <Checkbox
          checked={hideChorner}
          id="bch-hideChorner"
          onChange={() => setHideChorner(!hideChorner)}
        />
        <label htmlFor="bch-hideChorner" className='p-2'>hide cohost corner</label>
      </div>
      <div className='p-2'>
        <Checkbox
          checked={compactView}
          id="bch-compactView"
          onChange={() => setCompactView(!compactView)}
        />
        <label htmlFor="bch-compactView" className='p-2'>compact view</label>
      </div>
      <div className='p-2'>
        <Checkbox
          checked={widerFeed}
          id="bch-widerFeed"
          onChange={() => setWiderFeed(!widerFeed)}
        />
        <label htmlFor="bch-widerFeed" className='p-2'>make feed wider</label>
      </div>
      <div className='p-2'>
        <Checkbox
          checked={compactComments}
          id="bch-compactComments"
          onChange={() => setCompactComments(!compactComments)}
        />
        <label htmlFor="bch-compactComments" className='p-2'>compact comment sections</label>
      </div>
      <div>
        changes will appear after page refresh
      </div>
    </Dialog>
  )
}
