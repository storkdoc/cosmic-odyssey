/* Galaxy contact log. Redaction happens here, on the viewer’s tech, not by
   deleting the underlying event. Locked lines never include names or the body.
   Arrival uses the same d/v rule as the ruler. */
import { arrivalTime } from './engine/timeline.js';

export const CONTACT_SEED = [
  {
    id: 'cx-gw-behram',
    channel: 'gw',
    channelName: 'gravitational waves',
    from: 'Mara Quill',
    to: 'Ilya Voss',
    region: 'Behram Nebula',
    systemId: 'quiet-harbor',
    systemName: 'Quiet Harbor',
    distanceLy: 42,
    delayYr: 42,
    sentAt: 30,
    kind: 'first-contact',
    content: 'A greeting carried on gravitational waves: Stillwater keeps a light on, and the Long Relay is open.',
    flyby: 'Ilya Voss built Stillwater around a quiet K star. Ocean light, a low society, no weapons, a harbor.'
  },
  {
    id: 'cx-radio-late',
    channel: 'radio',
    channelName: 'radio',
    from: 'Soren Pell',
    to: 'Mara Quill',
    region: 'Glass Meridian',
    systemId: 'glass-meridian',
    systemName: 'Glass Meridian',
    distanceLy: 80,
    delayYr: 80,
    sentAt: 90,
    kind: 'knowledge',
    content: 'A radio note about disk chemistry. It has not had time to arrive.',
    flyby: ''
  }
];

export function arrivalOf(ev, epoch = 0) {
  return arrivalTime(epoch + ev.sentAt, ev.distanceLy, 1);
}

export function inLightCone(ev, cursor, epoch = 0) {
  return cursor + 1e-6 >= arrivalOf(ev, epoch) && arrivalOf(ev, epoch) >= epoch;
}

/* (a) existence, (b) channel and region, (c) participants, (d) content and flyby. */
export function redact(ev, comms) {
  const has = !!(comms && comms[ev.channel]);
  if (!has) {
    if (ev.channel === 'gw') {
      return { level: 'a', text: 'An unexplained exchange occurred near the Behram Nebula.', flyby: '' };
    }
    return { level: 'a', text: 'Signal detected: channel unknown.', flyby: '' };
  }
  return {
    level: 'd',
    text: ev.from + ' reached ' + ev.to + ' by ' + ev.channelName + ', ' + ev.distanceLy + ' ly away. The light-travel delay was ' + ev.delayYr + ' years. ' + ev.content,
    flyby: ev.flyby || ''
  };
}

export function viewLog(events, comms, cursor, epoch = 0) {
  const pending = events.filter((ev) => arrivalOf(ev, epoch) > cursor).length;
  const visible = events
    .filter((ev) => inLightCone(ev, cursor, epoch))
    .map((ev) => ({ id: ev.id, ...redact(ev, comms) }));
  return { pending, visible };
}
