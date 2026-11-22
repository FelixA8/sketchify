import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useBoard } from './context';
import { Icon } from './Icon';
import { WorkspaceResize } from './WorkspaceResize';
import { elementKey, layerAncestors, layerMembers, layerModel, type LayerNode } from './layers';

function Rename({ value, label, save, close }: { value: string; label: string; save: (value: string) => void; close: () => void }) {
  const input = useRef<HTMLInputElement>(null), canceled = useRef(false);
  useLayoutEffect(() => { input.current?.focus(); input.current?.select(); }, []);
  return <input ref={input} className="workspace-rename" aria-label={label} defaultValue={value} maxLength={100} autoComplete="off" spellCheck={false}
    onBlur={event => { if (!canceled.current) save(event.currentTarget.value); close(); }}
    onKeyDown={event => {
      event.stopPropagation(); if (event.nativeEvent.isComposing) return;
      if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
      if (event.key === 'Escape') { event.preventDefault(); canceled.current = true; close(); }
    }} />;
}

export function Workspace() {
  const { state: s } = useBoard();
  return <WorkspacePanel key={`${s.activePageId}:${s.sidebar}`} />;
}
function WorkspacePanel() {
  const { state: s, run } = useBoard();
  const model = useMemo(() => layerModel(s.elements, s.layers), [s.elements, s.layers]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null), [menu, setMenu] = useState<string | null>(null);
  const [pointerFocus, setPointerFocus] = useState(false);
  const [drag, setDrag] = useState<{ kind: 'page' | 'layer'; id: string } | null>(null);
  const [drop, setDrop] = useState<{ id: string; position: 'before' | 'after' | 'inside' } | null>(null);
  const sidebar = useRef<HTMLElement>(null);
  const selectedToken = [...s.selected].join('|');
  const [previousSelection, setPreviousSelection] = useState(selectedToken);
  if (previousSelection !== selectedToken) {
    setPreviousSelection(selectedToken);
    const reveal = new Set<string>();
    for (const id of s.selected) for (const ancestor of layerAncestors(model, elementKey(id))) reveal.add(ancestor.key);
    if (reveal.size) setCollapsed(previous => {
      if (![...reveal].some(key => previous.has(key))) return previous;
      return new Set([...previous].filter(key => !reveal.has(key)));
    });
  }
  useLayoutEffect(() => {
    sidebar.current?.querySelector<HTMLElement>('[data-selected=true]')?.scrollIntoView?.({ block: 'nearest' });
  }, [selectedToken, s.activePageId, s.sidebar]);
  const closeSidebar = () => run(a => {
    a.cancelLayerNavigation(); a.state.sidebar = false; a.persistence.schedule(); a.get('workspace-toggle').focus();
  });
  const toggle = (key: string) => setCollapsed(previous => { const next = new Set(previous); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const focusLayer = (key: string) => [...(sidebar.current?.querySelectorAll<HTMLButtonElement>('[data-layer-select]') ?? [])].find(button => button.dataset.layerSelect === key)?.focus();
  const layerKeys = (event: React.KeyboardEvent, node: LayerNode) => {
    if (event.target !== event.currentTarget || event.metaKey || event.ctrlKey) return;
    const items = [...sidebar.current!.querySelectorAll<HTMLButtonElement>('[data-layer-select]')], index = items.indexOf(event.currentTarget as HTMLButtonElement);
    if (event.key === 'ArrowDown') items[index + 1]?.focus();
    else if (event.key === 'ArrowUp') items[index - 1]?.focus();
    else if (event.key === 'Home') items[0]?.focus();
    else if (event.key === 'End') items.at(-1)?.focus();
    else if (event.key === 'ArrowRight' && node.children.length) { if (collapsed.has(node.key)) toggle(node.key); else focusLayer(node.children[0].key); }
    else if (event.key === 'ArrowLeft') { if (node.children.length && !collapsed.has(node.key)) toggle(node.key); else if (node.parent) focusLayer(node.parent); }
    else if (event.key === 'F2' && !s.layers[node.key]?.locked && !node.element?.locked && !layerAncestors(model, node.key).some(parent => s.layers[parent.key]?.locked || parent.element?.locked)) setEditing(node.key);
    else return;
    event.preventDefault();
  };
  const visibleRows: LayerNode[] = [];
  const collectRows = (nodes: LayerNode[]) => {
    for (const node of nodes) {
      visibleRows.push(node);
      if (!collapsed.has(node.key)) collectRows(node.children);
    }
  };
  collectRows(model.roots);
  const selectedRows = visibleRows.map(node => {
    const members = layerMembers(node);
    return members.length > 0 && (node.group ? members.every(element => s.selected.has(element.id)) : s.selected.has(node.element!.id));
  });
  const rowSelection = new Map(visibleRows.map((node, index) => [node.key, {
    selected: selectedRows[index],
    before: index > 0 && selectedRows[index - 1] && menu !== visibleRows[index - 1].key,
    after: index + 1 < visibleRows.length && selectedRows[index + 1] && menu !== node.key,
  }]));
  const renderLayers = (nodes: LayerNode[], depth = 0): React.ReactNode => <ul className="layer-list">{nodes.map(node => {
    const { selected, before, after } = rowSelection.get(node.key)!;
    const ancestors = layerAncestors(model, node.key);
    const inheritedLock = ancestors.some(parent => s.layers[parent.key]?.locked || parent.element?.locked);
    const inheritedHidden = ancestors.some(parent => s.layers[parent.key]?.hidden);
    const hidden = !!s.layers[node.key]?.hidden || inheritedHidden;
    const locked = inheritedLock || !!s.layers[node.key]?.locked || !!node.element?.locked;
    const siblings = node.parent ? model.nodes.get(node.parent)!.children : model.roots, index = siblings.indexOf(node);
    const rename = () => { if (!locked) { setMenu(null); setEditing(node.key); } };
    const select = (event: React.MouseEvent, reveal = false) => {
      const additive = event.shiftKey || event.metaKey || event.ctrlKey;
      setMenu(null);
      run(a => a.workspace.selectLayer(node.key, additive, reveal));
      if (!reveal && !additive) rename();
    };
    const iconLabel = hidden ? `Select ${node.name}` : `Select and locate ${node.name} on canvas`;
    return <li key={node.key} data-layer-key={node.key}>
      <div className={`workspace-row layer-row${hidden ? ' layer-hidden' : ''}`} data-selected={selected} data-selected-before={before} data-selected-after={after} data-drop={drop?.id === node.key ? drop.position : undefined} style={{ '--depth': Math.min(depth, 6) } as React.CSSProperties}
        draggable={!locked && !node.element?.containerId && !editing}
        onDragStart={event => { event.stopPropagation(); event.dataTransfer.setData('application/x-sketchify-layer', node.key); event.dataTransfer.effectAllowed = 'move'; setDrag({ kind: 'layer', id: node.key }); }}
        onDragEnd={() => { setDrag(null); setDrop(null); }}
        onDragOver={event => {
          if (drag?.kind !== 'layer' || drag.id === node.key) return;
          event.preventDefault(); event.stopPropagation();
          const rect = event.currentTarget.getBoundingClientRect(), fraction = (event.clientY - rect.top) / rect.height;
          const position = fraction < .25 ? 'before' : fraction > .75 ? 'after' : node.group || node.element?.type === 'frame' ? 'inside' : fraction < .5 ? 'before' : 'after';
          setDrop({ id: node.key, position });
        }}
        onDrop={event => {
          if (drag?.kind !== 'layer' || !drop) return;
          event.preventDefault(); event.stopPropagation(); run(a => a.workspace.moveLayer(drag.id, node.key, drop.position));
          setDrag(null); setDrop(null);
        }}>
        {node.children.length > 0 && <button className="workspace-icon branch-toggle" aria-label={`${collapsed.has(node.key) ? 'Expand' : 'Collapse'} ${node.name}`} aria-expanded={!collapsed.has(node.key)} onClick={() => toggle(node.key)}><span className={collapsed.has(node.key) ? '' : 'branch-open'}><Icon name="chevron" /></span></button>}
        <button className="workspace-icon layer-select" data-layer-select={node.key} aria-label={iconLabel} aria-pressed={selected} title={iconLabel} onKeyDown={event => layerKeys(event, node)} onClick={event => select(event, true)}><Icon name={node.group ? 'group' : node.element!.type} /></button>
        {editing === node.key ? <Rename value={node.name} label="Layer name" save={value => run(a => a.workspace.renameLayer(node.key, value))} close={() => { setEditing(null); queueMicrotask(() => focusLayer(node.key)); }} /> : <button className="layer-name" title={node.name} onClick={event => select(event)}>{node.name}</button>}
        <button className="workspace-icon layer-control" aria-label={`${s.layers[node.key]?.hidden ? 'Show' : 'Hide'} ${node.name}`} aria-pressed={hidden} disabled={inheritedHidden} title={inheritedHidden ? 'Show its parent first' : hidden ? 'Show layer' : 'Hide layer'} onClick={() => run(a => a.workspace.toggleLayer(node.key, 'hidden'))}><Icon name={hidden ? 'eyeOff' : 'eye'} /></button>
        <button className="workspace-icon layer-control" aria-label={`${locked ? 'Unlock' : 'Lock'} ${node.name}`} aria-pressed={locked} disabled={inheritedLock} title={inheritedLock ? 'Unlock its parent first' : locked ? 'Unlock layer' : 'Lock layer'} onClick={() => run(a => a.workspace.toggleLayer(node.key, 'locked'))}><Icon name={locked ? 'lock' : 'unlock'} /></button>
        <button className="workspace-icon" aria-label={`Actions for ${node.name}`} aria-expanded={menu === node.key} onClick={() => setMenu(menu === node.key ? null : node.key)}><Icon name="more" /></button>
      </div>
      {menu === node.key && <div className="workspace-actions" aria-label={`Layer actions for ${node.name}`}>
        <button disabled={locked} onClick={rename}>Rename</button>
        <button disabled={locked || !index} onClick={() => run(a => a.workspace.moveLayer(node.key, siblings[index - 1].key, 'before'))}>Move up</button>
        <button disabled={locked || index === siblings.length - 1} onClick={() => run(a => a.workspace.moveLayer(node.key, siblings[index + 1].key, 'after'))}>Move down</button>
        <label>Move to<select aria-label={`Move ${node.name} to`} disabled={locked || !!node.element?.containerId} value="" onChange={event => { const target = event.currentTarget.value; if (target) run(a => a.workspace.moveLayer(node.key, target === 'root' ? null : target, 'inside')); setMenu(null); }}><option value="">Choose destination</option><option value="root">Page root</option>{[...model.nodes.values()].filter(target => target.key !== node.key && (target.group || target.element?.type === 'frame') && !layerAncestors(model, target.key).some(parent => parent.key === node.key)).map(target => <option key={target.key} value={target.key}>{target.name}</option>)}</select></label>
      </div>}
      {node.children.length > 0 && !collapsed.has(node.key) && renderLayers(node.children, depth + 1)}
    </li>;
  })}</ul>;
  return <>
    {s.sidebar && !s.preferences.zenMode && <button className="workspace-backdrop" aria-label="Close pages and layers" onClick={() => run(a => { a.state.sidebar = false; a.persistence.schedule(); })} />}
    <aside ref={sidebar} id="workspace" className="surface workspace" aria-label="Pages and layers" hidden={!s.sidebar || s.preferences.zenMode} data-pointer-focus={pointerFocus}
      onPointerDownCapture={() => setPointerFocus(true)}
      onKeyDownCapture={event => { if (!['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) setPointerFocus(false); }}
      onKeyDown={event => {
        if (!event.metaKey && !event.ctrlKey) event.stopPropagation();
        if (event.key === 'Escape' && !editing) {
          if (menu) setMenu(null);
          else closeSidebar();
        }
      }}>
      <WorkspaceResize />
      <section className="workspace-pages" aria-labelledby="pages-heading">
        <div className="workspace-heading"><h2 id="pages-heading">Pages</h2><button className="workspace-icon" aria-label="Add page" title="Add page" onClick={() => run(a => a.workspace.addPage())}><Icon name="plus" /></button><button className="workspace-icon" aria-label="Close sidebar" onClick={closeSidebar}><Icon name="sidebar" /></button></div>
        <ul className="page-list">{s.pages.map((page, index) => <li key={page.id}>
          <div className="workspace-row page-row" data-selected={s.activePageId === page.id} data-drop={drop?.id === page.id ? drop.position : undefined} draggable={editing !== `p:${page.id}`}
            onDragStart={event => { event.dataTransfer.setData('application/x-sketchify-page', page.id); event.dataTransfer.effectAllowed = 'move'; setDrag({ kind: 'page', id: page.id }); }}
            onDragEnd={() => { setDrag(null); setDrop(null); }}
            onDragOver={event => { if (drag?.kind === 'page' && drag.id !== page.id) { event.preventDefault(); setDrop({ id: page.id, position: s.pages.findIndex(page => page.id === drag.id) < index ? 'after' : 'before' }); } }}
            onDrop={event => { if (drag?.kind === 'page') { event.preventDefault(); event.stopPropagation(); run(a => a.workspace.reorderPage(drag.id, page.id)); setDrag(null); setDrop(null); } }}>
            {editing === `p:${page.id}` ? <Rename value={page.name} label="Page name" save={value => run(a => a.workspace.renamePage(page.id, value))} close={() => setEditing(null)} /> : <button className="page-select" aria-current={s.activePageId === page.id ? 'page' : undefined} onClick={() => { setMenu(null); run(a => a.workspace.switchPage(page.id)); }} onDoubleClick={() => { setMenu(null); setEditing(`p:${page.id}`); }}>{page.name}</button>}
            <button className="workspace-icon" aria-label={`Page actions for ${page.name}`} aria-expanded={menu === `p:${page.id}`} onClick={() => setMenu(menu === `p:${page.id}` ? null : `p:${page.id}`)}><Icon name="more" /></button>
          </div>
          {menu === `p:${page.id}` && <div className="workspace-actions" aria-label={`Page actions for ${page.name}`}>
            <button onClick={() => { setMenu(null); setEditing(`p:${page.id}`); }}>Rename</button>
            <button onClick={() => { setMenu(null); run(a => a.workspace.duplicatePage(page.id)); }}>Duplicate</button>
            <button disabled={!index} onClick={() => run(a => a.workspace.reorderPage(page.id, s.pages[index - 1].id))}>Move up</button>
            <button disabled={index === s.pages.length - 1} onClick={() => run(a => a.workspace.reorderPage(page.id, s.pages[index + 1].id))}>Move down</button>
            <button className="workspace-danger" disabled={s.pages.length < 2} onClick={() => { setMenu(null); run(a => { a.state.deletingPage = page.id; a.openDialog('delete-page'); }); }}>Delete page</button>
          </div>}
        </li>)}</ul>
      </section>
      <section className="workspace-layers" aria-labelledby="layers-heading">
        <div className="workspace-heading"><h2 id="layers-heading">Layers</h2><button className="workspace-icon" aria-label="Collapse all layers" title="Collapse all layers" onClick={() => setCollapsed(new Set([...model.nodes.values()].filter(node => node.children.length).map(node => node.key)))}><Icon name="group" /></button></div>
        <div className="layer-scroll" onDragOver={event => { if (drag?.kind === 'layer' && event.target === event.currentTarget) { event.preventDefault(); setDrop({ id: 'root', position: 'inside' }); } }} onDrop={event => { if (drag?.kind === 'layer' && event.target === event.currentTarget) { event.preventDefault(); event.stopPropagation(); run(a => a.workspace.moveLayer(drag.id, null, 'inside')); setDrag(null); setDrop(null); } }} data-drop={drop?.id === 'root' ? 'inside' : undefined}>
          {model.roots.length ? renderLayers(model.roots) : <p className="workspace-empty">Draw something to see its layers here.</p>}
        </div>
      </section>
    </aside>
  </>;
}
