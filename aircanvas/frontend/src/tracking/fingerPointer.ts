import type { Hand, Feedback, XY, Gesture } from '../types';
import type { Editor } from '../storage/pageStore';
import { GestureRecognizer, HandIdentityResolver } from './gestureRecognizer';
import { GrabStateMachine } from './gestureStateMachine';
import { cameraToScreen } from '../canvas/coordinateTransforms';
import { OneEuroFilter } from '../canvas/smoothing';
export class AirController {
  isBlockedAt: ((point: XY) => boolean) | null = null;
  private panFilter = new OneEuroFilter();
  readonly grab = new GrabStateMachine();
  private writing = new GestureRecognizer();
  private navigation = new GestureRecognizer();
  private identities = new HandIdentityResolver();
  private wasDown = false;
  private stablePointFrames = 0;
  private blockedUntilRelease = false;
  private trail: XY[] = [];
  feedback: Feedback = {
    writing: false,
    navigation: false,
    drawing: false,
    pan: 'IDLE',
    warning: '',
    pointer: null,
    trail: [],
  };
  lastWriting: Gesture | null = null;
  lastNavigation: Gesture | null = null;
  keyboardDown = false;
  constructor(private editor: Editor) {}
  stop() {
    this.editor.end();
    this.wasDown = false;
    this.keyboardDown = false;
    this.blockedUntilRelease = true;
    this.grab.reset();
    this.panFilter.reset();
    this.writing.reset();
    this.navigation.reset();
    this.lastWriting = null;
    this.lastNavigation = null;
    this.trail = [];
    this.feedback = {
      writing: false,
      navigation: false,
      drawing: false,
      pan: 'IDLE',
      warning: '',
      pointer: null,
      trail: [],
    };
  }
  update(
    hands: Hand[],
    t: number,
    videoSize: { width: number; height: number },
    blocked = false,
    marker: XY | null = null,
  ) {
    const e = this.editor,
      s = e.settings,
      size = e.size;
    const valid = this.identities
      .resolve(hands, t)
      .filter((h) => h.confidence >= s.confidence)
      .map((h) =>
        s.invertHands
          ? { ...h, label: h.label === 'Right' ? ('Left' as const) : ('Right' as const) }
          : h,
      );
    const wh = valid.find((h) => h.label === s.writingHand),
      nh = valid.find((h) => h.label !== s.writingHand);
    const wg = wh ? this.writing.recognize(wh, s.pinch) : null,
      ng = nh ? this.navigation.recognize(nh, s.pinch) : null;
    if (!wh) {
      this.writing.reset();
      this.stablePointFrames = 0;
    }
    if (!nh) this.navigation.reset();
    this.lastWriting = wg;
    this.lastNavigation = ng;
    const map = (p: XY) =>
      cameraToScreen(p, videoSize.width, videoSize.height, size.width, size.height);
    if (!ng) this.panFilter.reset();
    const center = ng ? this.panFilter.next({ ...map(ng.center), t }, 0.6) : null;
    const pan = this.grab.update(blocked ? null : ng, center, t, s.grabSensitivity),
      grabbing = this.grab.state === 'GRABBING' || this.grab.state === 'DRAGGING';
    if (pan) e.pan(pan.x, pan.y);
    let pointer = s.mode === 'pen' ? (marker ? map(marker) : null) : wg ? map(wg.tip) : null;
    if (pointer && s.sensitivity !== 1)
      pointer = {
        x: size.width / 2 + (pointer.x - size.width / 2) * s.sensitivity,
        y: size.height / 2 + (pointer.y - size.height / 2) * s.sensitivity,
      };
    blocked =
      blocked ||
      !!(
        pointer &&
        (pointer.x < 0 ||
          pointer.y < 0 ||
          pointer.x > size.width ||
          pointer.y > size.height ||
          this.isBlockedAt?.(pointer))
      );
    this.stablePointFrames = wg?.pointing ? this.stablePointFrames + 1 : 0;
    if (s.mode === 'pen' && (ng?.open || ng?.fist)) this.keyboardDown = false;
    const requested =
      s.mode === 'pen'
        ? Boolean((ng?.pinch || this.keyboardDown) && !ng?.open && !ng?.fist)
        : s.activation === 'pinch'
          ? Boolean(wg?.pinch)
          : this.stablePointFrames >= 3;
    if (blocked || grabbing) {
      this.blockedUntilRelease = true;
      this.keyboardDown = false;
    }
    if (!requested && !blocked && !grabbing) this.blockedUntilRelease = false;
    const down =
      requested &&
      !blocked &&
      !grabbing &&
      !this.blockedUntilRelease &&
      !!pointer &&
      s.mode !== 'mouse';
    if (down && pointer) {
      if (!this.wasDown) e.begin({ ...pointer, t }, 'air');
      else e.append({ ...pointer, t });
    } else if (this.wasDown || (e.active && s.mode !== 'mouse')) e.end();
    this.wasDown = down && e.active;
    if (down && pointer) this.trail = [...this.trail.slice(-6), pointer];
    else this.trail = [];
    this.feedback = {
      writing: !!wh,
      navigation: !!nh,
      drawing: this.wasDown,
      pan: this.grab.state,
      pointer,
      trail: this.trail,
      warning:
        s.mode === 'pen' && !marker
          ? 'Marker lost — ink paused'
          : hands.length > 0 && valid.length < hands.length
            ? 'Low confidence — improve lighting'
            : valid.length === 0
              ? 'Show your hands in the camera'
              : '',
    };
    return this.feedback;
  }
}
