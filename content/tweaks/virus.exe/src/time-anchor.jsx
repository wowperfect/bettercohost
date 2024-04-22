import { useEffect, useRef, useState } from 'preact/hooks';
import { useSpring, useAnimation } from './animation.jsx';
import { STRINGS } from './strings.js';
import './time-anchor.less';

function remEuc(a, b) {
    return ((a % b) + b) % b;
}

export function TimeIcon({ value }) {
    const now = new Date();

    value = value || now;
    const nowValue = (now.getFullYear() * 12 + now.getMonth()) * 31 + now.getDate();
    const valueValue = (value.getFullYear() * 12 + value.getMonth()) * 31 + value.getDate();
    const delta = (valueValue - nowValue);

    const hourHand = useRef(null);
    const minuteHand = useRef(null);

    const hourPos = useSpring({ value: delta / 60 });
    const minutePos = useSpring({ value: delta });
    hourPos.setTarget(delta / 60);
    minutePos.setTarget(delta);

    const anim = useAnimation([hourHand, minuteHand], { hourPos, minutePos }, ({ hourPos, minutePos }) => {
        const transformOrigin = '12px 12px';
        const hourAngle = hourPos;
        const minuteAngle = Math.PI * 0.7 + minutePos;

        return [
            {
                transformOrigin,
                transform: `rotate(${remEuc(hourAngle, Math.PI * 2)}rad)`,
            },
            {
                transformOrigin,
                transform: `rotate(${remEuc(minuteAngle, Math.PI * 2)}rad)`,
            },
        ];
    });

    const [hourStyle, minuteStyle] = anim.getCurrentStyles();

    return (
        <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-linecap="round">
            <circle cx="12" cy="12" r="9" />
            <line x1="12" x2="12" y1="12" y2="6" ref={hourHand} style={hourStyle} />
            <line x1="12" x2="12" y1="12" y2="6" ref={minuteHand} style={minuteStyle} />
        </svg>
    );
}

export function TimeAnchorEditor({ value, onChange, onIconValueChange }) {
    value = value || new Date();

    const [year, setYear] = useState(value.getFullYear());
    const [month, setMonth] = useState(value.getMonth());
    const [date, setDate] = useState(value.getDate());

    const canApply = value.getFullYear() !== year || value.getMonth() !== month || value.getDate() !== date;

    useEffect(() => {
        onIconValueChange(new Date(year, month, date, 23, 59, 59));
    }, [year, month, date]);

    return (
        <div class="np-time-anchor-editor">
            <TimeWheel
                value={month}
                onChange={month => {
                    const newMonth = remEuc(month, 12);
                    const newYear = Math.floor(year + month / 12);

                    // switching from Mar 30 to Feb would cause a non-existent date! so we clamp
                    const daysInMonth = new Date(newYear, newMonth + 1, 0).getDate();
                    if (date > daysInMonth) setDate(daysInMonth);
                    setMonth(newMonth);
                    setYear(newYear);
                }}
                tickLabel={month => {
                    const m = remEuc(month, 12);
                    if (m === 0) return STRINGS.months[m] + ' \'' + Math.floor(year + month / 12).toString().slice(2);
                    return STRINGS.months[m];
                }}
                getPrevTick={month => month - 1}
                getNextTick={month => month + 1}
                snapToValue={value => Math.round(value)} />
            <TimeWheel
                value={date}
                onChange={date => {
                    const newDate = new Date(year, month, date);
                    setYear(newDate.getFullYear());
                    setMonth(newDate.getMonth());
                    setDate(newDate.getDate());
                }}
                tickLabel={date => {
                    return new Date(year, month, date).getDate().toString();
                }}
                getPrevTick={date => date - 1}
                getNextTick={date => date + 1}
                snapToValue={value => Math.round(value)} />
            <footer class="np-footer">
                <span />
                <button class="np-apply-button" disabled={!canApply} onClick={() => {
                    onChange(new Date(year, month, date, 23, 59, 59));
                }}>
                    {STRINGS.applyTimeAnchor}
                </button>
            </footer>
        </div>
    );
}

function TimeWheel({
    value, onChange,
    getPrevTick, getNextTick,
    tickLabel, snapToValue,
}) {
    const [floatDelta, setFloatDelta] = useState(0);

    const RADIUS = 300;
    const TICK_ANGLE = 10 / 180 * Math.PI;

    const ticks = [];
    const renderTick = (d) => {
        const tickValue = snapToValue(value + floatDelta) + d;
        const isCurrent = tickValue === value;

        const rot = (tickValue - (value + floatDelta)) * TICK_ANGLE;
        if (rot > Math.PI / 2 || rot < -Math.PI / 2) return;

        ticks.push(
            <div key={tickValue} class={'np-time-tick' + (isCurrent ? ' is-current' : '')} style={{
                transform: `translate(-50%, -50%) translateZ(-${RADIUS}px) rotateY(${rot}rad) translateZ(${RADIUS}px)`,
                opacity: 1 - Math.abs(rot) / (Math.PI / 2),
            }}>
                {tickLabel(tickValue)}
            </div>
        );
    };

    renderTick(0);
    for (let d = 1; d < 8; d++) {
        renderTick(d);
        renderTick(-d);
    }

    const scrollAnimator = useRef({
        active: null,
        velocity: 0,
        value: 0,
        floatDelta: 0,
        freeTarget: false,
    });
    scrollAnimator.current.value = value;
    scrollAnimator.current.floatDelta = floatDelta;

    const startScrollAnimator = () => {
        if (scrollAnimator.current.active) return;
        const id = Math.random();
        scrollAnimator.current.active = {
            id,
            lastTime: Date.now(),
        };
        const loop = () => {
            if (scrollAnimator.current.active?.id !== id) return;
            requestAnimationFrame(loop);

            const dTime = Math.min(1 / 40, (Date.now() - scrollAnimator.current.active.lastTime) / 1000);
            scrollAnimator.current.active.lastTime = Date.now();

            const newDelta = scrollAnimator.current.floatDelta + scrollAnimator.current.velocity * dTime;
            setFloatDelta(newDelta);
            scrollAnimator.current.velocity -= scrollAnimator.current.velocity * 20 * dTime;

            const unsnappedValue = scrollAnimator.current.value + newDelta;
            const snappedValue = snapToValue(unsnappedValue);
            if (scrollAnimator.current.freeTarget && snappedValue !== scrollAnimator.current.value) {
                onChange(snappedValue);
                setFloatDelta(unsnappedValue - snappedValue);
            }

            const target = scrollAnimator.current.freeTarget
                ? (snappedValue - unsnappedValue)
                : 0;
            const f = Math.max(0, 60 - scrollAnimator.current.velocity) * (target - scrollAnimator.current.floatDelta);
            scrollAnimator.current.velocity += f * dTime;

            if (Math.abs(floatDelta) + Math.abs(scrollAnimator.current.velocity) < 0.01) {
                setFloatDelta(0);
                scrollAnimator.current.active = null;
                scrollAnimator.current.velocity = 0;
                scrollAnimator.current.freeTarget = false;
            }
        };
        requestAnimationFrame(loop);
    };
    const stopScrollAnimator = () => {
        scrollAnimator.current.active = null;
    };

    useEffect(() => {
        if (!scrollAnimator.current.freeTarget) {
            startScrollAnimator();
        }
    }, [value]);

    const getAngle = x => Math.asin(Math.max(-1, Math.min(1, x / RADIUS)));
    const angleDeltaToTickDelta = delta => delta / TICK_ANGLE;

    const timeScroller = useRef(null);
    const pointerState = useRef(null);
    const onPointerDown = (e) => {
        const scrollerRect = timeScroller.current.getBoundingClientRect();
        const x = (e.clientX - scrollerRect.left) - scrollerRect.width / 2;

        pointerState.current = { moved: 0, t: getAngle(x), time: Date.now() };
        timeScroller.current.setPointerCapture(e.pointerId);
        stopScrollAnimator();
    };
    const onPointerMove = (e) => {
        if (!pointerState.current) return;
        const scrollerRect = timeScroller.current.getBoundingClientRect();
        const x = (e.clientX - scrollerRect.left) - scrollerRect.width / 2;
        const t = getAngle(x);
        const dTick = angleDeltaToTickDelta(pointerState.current.t - t);
        const dTime = (Date.now() - pointerState.current.time) / 1000;
        pointerState.current.t = t;
        pointerState.current.time = Date.now();
        pointerState.current.moved += dTick;

        const newValue = value + floatDelta + dTick;
        if (snapToValue(newValue) !== value) {
            onChange(snapToValue(newValue));
            setFloatDelta(newValue - snapToValue(newValue));
        } else {
            setFloatDelta(floatDelta + dTick);
        }
        if (dTime > 0) {
            scrollAnimator.current.velocity = dTick / dTime;
        }
    };
    const onPointerUp = (e) => {
        timeScroller.current.releasePointerCapture(e.pointerId);

        if (Math.abs(pointerState.current.moved) < 0.2) {
            pointerState.current = null;
            const scrollerRect = timeScroller.current.getBoundingClientRect();
            const x = (e.clientX - scrollerRect.left) - scrollerRect.width / 2;
            const t = getAngle(x);
            const dTick = angleDeltaToTickDelta(t);
            onChange(snapToValue(value + floatDelta + dTick));
            scrollAnimator.current.freeTarget = false;
            return;
        }

        pointerState.current = null;

        onChange(snapToValue(value + floatDelta));
        setFloatDelta((value + floatDelta) - snapToValue(value + floatDelta));
        stopScrollAnimator();
        startScrollAnimator();
        scrollAnimator.current.freeTarget = true;
    };

    const onWheel = e => {
        e.preventDefault();
        const dTick = e.deltaX / 50;

        const unsnappedValue = value + floatDelta + dTick;
        stopScrollAnimator();
        onChange(snapToValue(unsnappedValue));
        setFloatDelta(unsnappedValue - snapToValue(unsnappedValue));
        scrollAnimator.current.velocity = dTick;

        startScrollAnimator();
        scrollAnimator.current.value = unsnappedValue;
        scrollAnimator.current.floatDelta = unsnappedValue - snapToValue(unsnappedValue);
        scrollAnimator.current.freeTarget = true;
    };

    return (
        <div class="np-time-wheel">
            <div
                class="np-time-scroller"
                ref={timeScroller}
                onWheel={onWheel}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}>
                {ticks}
            </div>
        </div>
    );
}
