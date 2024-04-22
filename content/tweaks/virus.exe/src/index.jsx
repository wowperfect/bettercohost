import { render } from 'preact';
import { useState } from 'preact/hooks';
import { Popover } from './popover.jsx';
import { themeLoader } from './theme-loader.js';

function init() {
    const popoverContainer = document.createElement('div');
    popoverContainer.id = 'conotifpopover';
    document.body.appendChild(popoverContainer);
    themeLoader.init(popoverContainer);

    let openPopover;

    function Container() {
        const [open, setOpen] = useState(false);
        const [anchorNode, setAnchorNode] = useState(document.body);

        openPopover = (anchor) => {
            themeLoader.update();
            setOpen(true);
            setAnchorNode(anchor);
        };

        return (
            <Popover
                open={open}
                onClose={() => setOpen(false)}
                onCancel={() => setOpen(false)}
                anchor={anchorNode} />
        );
    }
    render(<Container />, popoverContainer);
    console.debug('notification popover initialized');

    return (anchor) => openPopover(anchor);
}

let didInit = false;
let openPopover;
function tryInit() {
    if (document.body && !didInit) {
        openPopover = init();
        didInit = true;
    }
}

// because react will hydrate the DOM some time after load, we can't reliably
// hook into the notifications button itself.
// instead, we'll just check every click
window.addEventListener('click', e => {
    if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;

    // check each parent to see if it matches
    let cursor = e.target;
    for (let i = 0; i < 10; i++) {
        if (!cursor) break;
        if (cursor.tagName === 'A' && cursor.href.endsWith('project/notifications') && !cursor.className.includes('np-open')) {
            e.preventDefault();
            // the <a> has a zero rect for some reason, so we'll prefer the li inside
            const anchorNode = cursor.querySelector('li') || cursor;
            openPopover(anchorNode);
            return;
        }
        cursor = cursor.parentNode;
    }
});

// just make it happen somehow
window.addEventListener('DOMContentLoaded', () => {
    tryInit();
});
tryInit();
