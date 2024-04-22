import { createRef, Component } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { shouldReduceMotion, useSpring, useAnimation } from './animation.jsx';
import { Notifications } from './notifications.jsx';
import './popover.less';

const DIALOG_SUPPORTED = ('HTMLDialogElement' in window)
    && (typeof window.HTMLDialogElement.prototype.showModal === 'function');

class ModalPortal extends Component {
    dialog = createRef();

    state = {
        mounted: false,
    };

    constructor(props) {
        super(props);
    }

    lastShownModalDialog = null;
    lastShownDialogWasModal = null;
    showModal() {
        if (!DIALOG_SUPPORTED) {
            this.setState({ mounted: true });
            return;
        }
        if (this.lastShownModalDialog === this.dialog.current
            && this.lastShownDialogWasModal === !this.props.disableModal
            && this.dialog.current.open) {
            // already in opened state
            return;
        }
        this.closeModal(); // clean up if needed
        if (this.props.disableModal) {
            this.dialog.current.show();
        } else {
            this.dialog.current.showModal();
        }
        this.lastShownModalDialog = this.dialog.current;
        this.setState({ mounted: true });
    }

    closeModal() {
        if (DIALOG_SUPPORTED && this.lastShownModalDialog) {
            this.lastShownModalDialog.close();
            this.lastShownModalDialog = null;
            this.setState({ mounted: false });
        } else if (DIALOG_SUPPORTED) {
            this.setState({ mounted: false });
        }
    }

    componentDidMount() {
        this.dialog.current?.addEventListener('cancel', this.onCancel);
    }

    componentDidUpdate(prevProps) {
        if (prevProps.mounted !== this.props.mounted || prevProps.disableModal !== this.props.disableModal) {
            if (this.props.mounted) {
                this.showModal();
            } else {
                this.closeModal();
            }
        }
    }

    componentWillUnmount() {
        this.closeModal();
    }

    onCancel = (e) => {
        e.preventDefault();
        this.props?.onCancel();
    };

    render({ class: className, mounted, children }) {
        const DialogElement = DIALOG_SUPPORTED ? 'dialog' : 'div';

        return (
            <DialogElement
                class={'np-modal-dialog ' + (DIALOG_SUPPORTED ? '' : 'dialog-is-unsupported ') + (className || '')}
                ref={this.dialog}>
                {mounted && this.state.mounted ? children : null}
            </DialogElement>
        );
    }
}

function InnerPopover({ open, anchor, onClose, onUnmount }) {
    const presence = useSpring({ dampingRatio: 0.8, target: 1 });
    const height = useSpring({ value: 128 });
    const posY = useSpring({ value: -1 });
    presence.setTarget(open ? 1 : 0);

    const contentsNode = useRef(null);
    const [contentsWidth, setContentsWidth] = useState(0);
    const [contentsHeight, setContentsHeight] = useState(height.target);

    const didSetInitialPosY = useRef(false);
    useLayoutEffect(() => {
        const contents = contentsNode.current;
        if (!contents) return;
        setContentsWidth(contents.offsetWidth);
        setContentsHeight(contents.offsetHeight);

        if (!didSetInitialPosY.current) {
            didSetInitialPosY.current = true;
            posY.setValue(posY.target);
        }
    });

    useEffect(() => {
        observer = new ResizeObserver(() => {
            setContentsWidth(contentsNode.current.offsetWidth);
            setContentsHeight(contentsNode.current.offsetHeight);
        });
        observer.observe(contentsNode.current);

        return () => observer.disconnect();
    }, [contentsNode.current]);

    const [, setUpdateValue] = useState(0);
    useEffect(() => {
        const doUpdate = () => setUpdateValue(Math.random());
        window.addEventListener('resize', doUpdate);
        window.addEventListener('scroll', doUpdate, { passive: true });
        return () => {
            window.removeEventListener('scroll', doUpdate);
            window.removeEventListener('resize', doUpdate);
        };
    }, []);

    height.setTarget(contentsHeight);

    let arrowSize = 16;

    const anchorRect = anchor.getBoundingClientRect();
    const vv = window.visualViewport;
    let anchorPos = [
        vv.offsetLeft + anchorRect.left + anchorRect.width,
        vv.offsetTop + anchorRect.top + anchorRect.height / 2,
    ];

    const lastAnchorPos = useRef(anchorPos);
    if (!anchorRect.width && !anchorRect.height) {
        // probably unmounted
        anchorPos = lastAnchorPos.current;
    } else {
        lastAnchorPos.current = anchorPos;
    }

    let x = anchorPos[0] + arrowSize / 2;
    let y = anchorPos[1] - arrowSize - Math.min(64, contentsHeight);

    let padX = Math.min(window.innerWidth * vv.scale - contentsWidth, 16) / 2;
    let padY = Math.min(window.innerHeight * vv.scale - contentsHeight, 16) / 2;

    x = Math.min(x, window.innerWidth * vv.scale - contentsWidth - padX);
    y = Math.min(y, window.innerHeight * vv.scale - contentsHeight - padY);
    x = Math.max(x, padX);
    y = Math.max(y, padY);
    x = Math.round(x);
    y = Math.round(y);

    // when the popover doesn't fit on the screen beside the notifications button
    const isFloating = x < anchorPos[0];

    posY.setTarget(y);

    const animParams = useRef(null);
    animParams.current = [anchorPos, x, y, open];

    const dialogNode = useRef(null);
    const arrowNode = useRef(null);

    const anim = useAnimation([dialogNode, arrowNode],
        { presence, posY, height },
        ({ presence, posY, height }) => {
            const [anchor, x, y, open] = animParams.current;

            let arrowY = anchor[1] - posY - arrowSize / 2;
            let arrowHidden = arrowY < 0 || arrowY > height;
            if (arrowY < 8) arrowY = 8;
            if (arrowY > height - 8) arrowY = height - 8;

            const arrowStyle = {
                top: arrowY + 'px',
                opacity: arrowHidden ? 0 : 1,
            };

            const dialogStyle = !shouldReduceMotion() ? {
                transformOrigin: `${anchor[0] - x}px ${anchor[1] - y}px`,
                transform: `translate(${x}px, ${posY}px) scale(${Math.max(0, presence)})`,
                opacity: open ? (didSetInitialPosY.current ? 1 : 0) : presence,
                height: height + 'px',
            } : {
                transform: `translate(${x}px, ${posY}px)`,
                opacity: presence,
                height: height + 'px',
            };

            return [dialogStyle, arrowStyle];
        });

    useEffect(() => {
        const onFinish = () => {
            if (!presence.target) onUnmount();
        };

        anim.on('finish', onFinish);
        return () => anim.removeListener('finish', onFinish);
    }, [anim]);
    const [dialogNodeStyle, arrowNodeStyle] = anim.getCurrentStyles();

    return (
        <div class="np-popover-container">
            <div class="np-popover-backdrop" onClick={onClose} />
            <div class={'np-popover' + (isFloating ? ' is-floating' : '')} ref={dialogNode} style={dialogNodeStyle}>
                <div class="np-popover-arrow" ref={arrowNode} style={arrowNodeStyle} />
                <div class="np-popover-clip">
                    <div class="np-popover-contents" ref={contentsNode}>
                        <Notifications isFloating={isFloating} onClose={onClose} />
                    </div>
                </div>
            </div>
        </div>
    );
}

export function Popover({ open, onClose, onCancel, anchor }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        if (open) setMounted(true);
    }, [open]);

    return (
        <ModalPortal mounted={mounted} onCancel={onCancel}>
            <InnerPopover
                open={open}
                anchor={anchor}
                onClose={onClose}
                onUnmount={() => setMounted(false)} />
        </ModalPortal>
    );
}
