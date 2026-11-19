/**
 * dsh-plugin-finder — Host half.
 *
 * Nothing runs on the Host: the whole feature is page UI. This row exists so the
 * bundle is an enabled Loader entry — the Client half is only served for enabled
 * entries — and so the plugin appears, with its localized title and icon, in the
 * very list it puts a search box on.
 */

/** No Host behaviour to register. */
export function apply() {}
