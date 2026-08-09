// Wraps a build-time-rendered Mermaid diagram in something that can be read.
//
// rehype-mermaid drops the measured `<svg>` straight into the prose. Two things
// then go wrong on a real page: the diagram inherits the article's colours (its
// labels are dark, so it disappears against the dark theme), and the wide one in
// docs/architecture.md is three thousand pixels across, which a browser will
// happily squash into an illegible three-inch strip. So each diagram gets a
// frame it can scroll inside, and its natural width back.

import { visit } from 'unist-util-visit';

export function rehypeDiagramFrame() {
  return (tree) => {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'svg' || !parent || index === undefined) return;
      if (parent.type === 'element' && parent.properties?.className?.includes?.('diagram')) return;

      // Mermaid measures the diagram and writes the result into the viewBox.
      // Turning that into an explicit width is what lets the frame scroll
      // instead of scaling the labels down to nothing.
      const viewBox = String(node.properties?.viewBox ?? '').split(/\s+/);
      const width = Number(viewBox[2]);
      if (Number.isFinite(width) && width > 0) {
        node.properties.width = Math.round(width);
        node.properties.height = undefined;
        node.properties.style = undefined;
      }

      parent.children[index] = {
        type: 'element',
        tagName: 'figure',
        properties: { className: ['diagram'] },
        children: [node],
      };
      return [visit.SKIP, index + 1];
    });
  };
}
