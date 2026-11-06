// CSS is exercised by the browser; the DOM regression executes the production React tree.
export async function load(url, context, nextLoad) {
  if (/\.css(?:\?inline)?$/.test(url)) return {format:'module',source:'export default "";',shortCircuit:true};
  return nextLoad(url,context);
}
