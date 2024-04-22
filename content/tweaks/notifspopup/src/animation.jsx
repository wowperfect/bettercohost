import { createRef } from 'preact';
import { useEffect, useMemo } from 'preact/hooks';
import EventEmitter from 'events';

export function getNow() {
    return (document.timeline?.currentTime || Date.now()) / 1000;
}

export function shouldReduceMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Calculates spring position and velocity for any given condition.
 *
 * equations copied from
 * http://people.physics.tamu.edu/agnolet/Teaching/Phys_221/MathematicaWebPages/4_DampedHarmonicOsc
 * illator.pdf
 */
export class SpringSolver {
    target = 0;

    constructor(dampingRatio, period) {
        this.dampingRatio = dampingRatio;
        this.friction = dampingRatio * (4 * Math.PI / period);
        this.hydrateParams(0, 0);
    }

    hydrateParams(initialValue, initialVelocity) {
        if (this.target === null) {
            // uncontrolled “spring”
            this.initialValueOffset = initialValue + (this.friction === 0
                ? 0
                : initialVelocity / this.friction);
            this.initialVelocity = initialVelocity;
            return;
        }

        initialValue -= this.target;

        this.undampedAngularFrequency = this.dampingRatio === 0
            ? 0
            : this.friction / this.dampingRatio / 2;
        this.dampedAngularFrequency =
            this.undampedAngularFrequency * Math.sqrt(1 - this.dampingRatio ** 2),
        this.angularOffset = Math.atan2(
            2 * initialVelocity + this.friction * initialValue,
            2 * initialValue * this.dampedAngularFrequency,
        );
        this.amplitudeFactor = Math.abs(initialValue) < 1e-5
            ? Math.sign(initialVelocity) * initialVelocity / this.dampedAngularFrequency
            : initialValue / Math.cos(this.angularOffset);
        this.dampedFriction = Math.max(
            // approximate zero because lim is too expensive to compute
            1e-5,
            Math.sqrt((this.friction / 2) ** 2 - this.undampedAngularFrequency ** 2) * 2,
        );
        this.a1 = (-2 * initialVelocity + initialValue * (-this.friction + this.dampedFriction))
            / (2 * this.dampedFriction);
        this.a2 = (2 * initialVelocity + initialValue * (this.friction + this.dampedFriction))
            / (2 * this.dampedFriction);
    }

    retarget(t, newTarget) {
        const value = this.getValue(t);
        const velocity = this.getVelocity(t);
        this.target = newTarget;
        this.hydrateParams(value, velocity);
    }

    resetVelocity(t, newVelocity) {
        const value = this.getValue(t);
        this.hydrateParams(value, newVelocity);
    }

    resetDampingRatio(t, newDampingRatio) {
        const value = this.getValue(t);
        const velocity = this.getVelocity(t);
        this.dampingRatio = newDampingRatio;
        this.hydrateParams(value, velocity);
    }

    resetFriction(t, newFriction) {
        const value = this.getValue(t);
        const velocity = this.getVelocity(t);
        this.friction = newFriction;
        this.hydrateParams(value, velocity);
    }

    resetPeriod(t, newPeriod) {
        this.resetFriction(t, this.dampingRatio * (4 * Math.PI / newPeriod));
    }

    resetValue(t, newValue) {
        const velocity = this.getVelocity(t);
        this.hydrateParams(newValue, velocity);
    }

    getValue(t) {
        if (this.target === null) {
            if (this.friction === 0) return this.initialValueOffset + t * this.initialVelocity;

            // no target means the only active part of the equation is v' = -cv
            // => solution: v = k * e^(-cx); integral: x = -k * e^(-cx) / c + C
            return this.initialValueOffset - this.initialVelocity
                * Math.exp(-t * this.friction) / this.friction;
        }

        let value;
        if (this.dampingRatio < 1) {
            // underdamped
            value = this.amplitudeFactor * Math.exp(-t * this.friction / 2)
                * Math.cos(this.dampedAngularFrequency * t - this.angularOffset);
        } else {
            // critically damped or overdamped
            value = this.a1 * Math.exp(t * (-this.friction - this.dampedFriction) / 2)
                + this.a2 * Math.exp(t * (-this.friction + this.dampedFriction) / 2);
        }
        return value + this.target;
    }

    getVelocity(t) {
        if (this.target === null) {
            return this.initialVelocity * Math.exp(-t * this.friction);
        }

        if (this.dampingRatio < 1) {
            // underdamped
            return this.amplitudeFactor * (-this.friction / 2 * Math.exp(-t * this.friction / 2)
                * Math.cos(this.dampedAngularFrequency * t - this.angularOffset)
                - this.dampedAngularFrequency * Math.exp(-t * this.friction / 2)
                * Math.sin(this.dampedAngularFrequency * t - this.angularOffset));
        } else {
            // critically damped or overdamped
            return this.a1 * (-this.friction - this.dampedFriction) / 2
                * Math.exp(t * (-this.friction - this.dampedFriction) / 2)
                + this.a2 * (-this.friction + this.dampedFriction) / 2
                * Math.exp(t * (-this.friction + this.dampedFriction) / 2);
        }
    }
}

export class Spring {
    motionThreshold = 1 / 1000;
    lastReset = getNow();

    constructor (initial = {}) {
        this.dampingRatio = initial.dampingRatio ?? 1;
        this.period = initial.period ?? 0.3;

        this.inner = new SpringSolver(this.dampingRatio, this.period);
        if (Number.isFinite(initial.value)) {
            this.inner.resetValue(0, initial.value);
        }
        if (Number.isFinite(initial.target)) {
            this.inner.retarget(0, initial.target);
        } else if (Number.isFinite(initial.value)) {
            this.inner.retarget(0, initial.value);
        }
        if (Number.isFinite(initial.motionThreshold)) {
            this.motionThreshold = initial.motionThreshold;
        }
    }

    getInnerT (time) {
        return Math.max(0, time - this.lastReset);
    }

    setDampingRatio (dr, time = getNow()) {
        if (this.dampingRatio === dt) return;
        this.dampingRatio = dt;
        this.inner.resetDampingRatio(this.getInnerT(time), dr);
        this.lastReset = time;
    }

    setPeriod (period, time = getNow()) {
        if (this.period === period) return;
        this.period = period;
        this.inner.resetPeriod(this.getInnerT(time), period);
        this.lastReset = time;
    }

    setTarget (target, time = getNow()) {
        if (this.inner.target === target) return;
        this.inner.retarget(this.getInnerT(time), target);
        this.lastReset = time;
    }

    setValue (value, time = getNow()) {
        this.inner.resetValue(this.getInnerT(time), value);
        this.lastReset = time;
    }
    forceReset (time = getNow()) {
        this.inner.retarget(this.getInnerT(time), this.target);
        this.lastReset = time;
    }

    get target () {
        return this.inner.target;
    }

    getValue (time = getNow()) {
        const t = this.getInnerT(time);
        const value = this.inner.getValue(t);
        const velocity = this.inner.getVelocity(t);
        if (Math.abs(this.target - value) + Math.abs(velocity) < this.motionThreshold) {
            return this.target;
        }
        return value;
    }
    getVelocity (time = getNow()) {
        return this.inner.getVelocity(this.getInnerT(time));
    }
    shouldStop (time = getNow()) {
        return Math.abs(this.target - this.getValue(time))
            + Math.abs(this.getVelocity(time)) < this.motionThreshold;
    }
}

export class ElAnim extends EventEmitter {
    node = createRef();

    /** Number of seconds to generate keyframes for in advance */
    keyframeGenerationInterval = 1;
    /** Time-step between each keyframe */
    keyframeTimeStep = 1 / 60;

    useAnimationFillForwards = true;

    constructor (computeStyles, nodeRef, options = {}) {
        super();
        this.computeStyles = computeStyles;
        if (nodeRef) this.node = nodeRef;
        if ('useAnimationFillForwards' in options) {
            this.useAnimationFillForwards = options.useAnimationFillForwards;
        }
    }

    // Map<Object, lastResetTimestamp (number)>
    #currentInputs = new Map();
    #lastInputsObject = null;
    #needsUpdate = false;
    /**
     * Sets inputs. `inputs` can be any sort of associative object or array.
     * Its shape will be passed on to computeStyles.
     */
    setInputs (inputs) {
        let needsResolve = this.#needsUpdate;
        this.#needsUpdate = false;

        // determine whether we need to resolve the animation again.
        // we keep track of changes using the lastReset property
        const newInputs = new Set();
        for (const k in inputs) {
            if (!inputs.hasOwnProperty(k)) continue;
            const item = inputs[k];
            newInputs.add(item);
            if (this.#currentInputs.has(item)) {
                const currentReset = this.#currentInputs.get(item);
                if (item.lastReset !== currentReset) {
                    needsResolve = true;
                }
            } else {
                this.#currentInputs.set(item, item.lastReset);
                needsResolve = true;
            }
        }
        for (const item of this.#currentInputs) {
            if (!newInputs.has(item)) {
                // removed. we don't really need a resolve for this though
                this.#currentInputs.delete(item);
            }
        }

        this.#lastInputsObject = inputs;
        if (needsResolve) this.resolve();
    }

    setNeedsUpdate () {
        this.#needsUpdate = true;
    }

    didMount () {
        // so that any update will trigger a resolve
        this.setNeedsUpdate();
        // resolve now also
        this.resolve();
    }

    doComputeStyles (time) {
        const inputs = Array.isArray(this.#lastInputsObject)
            ? [...this.#lastInputsObject]
            : { ...this.#lastInputsObject };

        for (const k in inputs) {
            if (!inputs.hasOwnProperty(k)) continue;
            inputs[k] = inputs[k].getValue(time);
        }

        return this.computeStyles(inputs, time);
    }

    getCurrentStyles () {
        return this.doComputeStyles(getNow());
    }

    animations = [];
    resolve () {
        if (this.dropped) return;
        const nodes = (Array.isArray(this.node)
            ? this.node.map(item => item.current)
            : [this.node.current])
            .filter(x => x);
        if (!nodes.length) return;
        let scheduleRefresh = true;

        const now = getNow();
        const keyframes = [];
        let dt = 0;
        for (; dt < this.keyframeGenerationInterval; dt += this.keyframeTimeStep) {
            const t = now + dt;

            const styles = this.doComputeStyles(t);
            if (Array.isArray(styles)) {
                keyframes.push(styles);
            } else {
                keyframes.push([styles]);
            }

            let shouldStop = true;
            for (const input of this.#currentInputs.keys()) {
                if (!input.shouldStop(t)) {
                    shouldStop = false;
                    break;
                }
            }

            if (shouldStop) {
                scheduleRefresh = false;
                break;
            }
        }

        for (const anim of this.animations) anim.cancel();
        this.animations = nodes.map((node, i) => node.animate(keyframes.map(x => x[i]), {
            duration: dt * 1000,
            easing: 'linear',
            fill: this.useAnimationFillForwards ? 'forwards' : 'none',
        }));
        this.emit('resolve', this.animations);

        if (scheduleRefresh) {
            this.animations[0].addEventListener('finish', () => {
                if (this.dropped) return;
                this.resolve();
            });
        } else {
            this.animations[0].addEventListener('finish', () => {
                if (this.dropped) return;
                if (!this.useAnimationFillForwards) {
                    for (const anim of this.animations) anim.cancel();
                    this.animations = [];
                }
                this.emit('finish');
            });
        }
    }

    /** call this inside componentWillUnmount to clean up timers */
    drop () {
        for (const anim of this.animations) anim.cancel();
        this.dropped = true;
    }
}

export function useSpring(initial) {
    return useMemo(() => new Spring(initial), []);
}

// NOTE: inputs and styles are read only once on the first call
export function useAnimation(refs, inputs, styles) {
    const anim = useMemo(() => new ElAnim(styles, refs), []);
    anim.setInputs(inputs);

    useEffect(() => {
        anim.didMount();

        return () => {
            anim.drop();
        };
    }, []);

    return anim;
}
