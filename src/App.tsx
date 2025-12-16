import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Trash2, RotateCcw, ZoomIn, ZoomOut, Move, Grip } from 'lucide-react';

// ============================================
// CONSTANTES POUR LE LAYOUT
// ============================================

const NODE_WIDTH = 150;
const NODE_HEIGHT = 60;

// Distances radiales par défaut (utilisées pour le positionnement initial)
const RADIUS_LEVEL_1 = 250;
const SUB_BRANCH_RADIUS = 140;
const FAN_ANGLE_SPREAD = Math.PI / 2;
const MAX_FAN_ANGLE_STEP = Math.PI / 6;

// ============================================
// UTILITAIRES
// ============================================

// Génère un ID unique
const generateId = () => Math.random().toString(36).substr(2, 9);

// Calcule les positions initiales radiales pour tous les nœuds
const calculateInitialPositions = (node, parentX = 0, parentY = 0, parentAngle = 0, level = 0) => {
  let positions = {};
  
  if (level === 0) {
    // Racine au centre
    positions[node.id] = { x: 0, y: 0 };
    
    if (node.children && node.children.length > 0) {
      const angleStep = (2 * Math.PI) / node.children.length;
      node.children.forEach((child, index) => {
        const angle = index * angleStep - Math.PI / 2;
        const childX = RADIUS_LEVEL_1 * Math.cos(angle);
        const childY = RADIUS_LEVEL_1 * Math.sin(angle);
        positions[child.id] = { x: childX, y: childY };
        
        // Récursion pour les enfants
        const childPositions = calculateInitialPositions(child, childX, childY, angle, level + 1);
        positions = { ...positions, ...childPositions };
      });
    }
  } else {
    // Niveaux 2+
    if (node.children && node.children.length > 0) {
      const childrenCount = node.children.length;
      let angleStep, startAngle;
      
      if (childrenCount === 1) {
        angleStep = 0;
        startAngle = 0;
      } else {
        angleStep = Math.min(FAN_ANGLE_SPREAD / (childrenCount - 1), MAX_FAN_ANGLE_STEP);
        startAngle = -((childrenCount - 1) * angleStep) / 2;
      }
      
      node.children.forEach((child, index) => {
        const relativeAngle = startAngle + index * angleStep;
        const absoluteAngle = parentAngle + relativeAngle;
        const childX = parentX + SUB_BRANCH_RADIUS * Math.cos(absoluteAngle);
        const childY = parentY + SUB_BRANCH_RADIUS * Math.sin(absoluteAngle);
        positions[child.id] = { x: childX, y: childY };
        
        const childPositions = calculateInitialPositions(child, childX, childY, absoluteAngle, level + 1);
        positions = { ...positions, ...childPositions };
      });
    }
  }
  
  return positions;
};

// Collecte tous les liens parent-enfant
const collectConnections = (node, connections = []) => {
  if (node.children) {
    node.children.forEach(child => {
      connections.push({ from: node.id, to: child.id });
      collectConnections(child, connections);
    });
  }
  return connections;
};

// ============================================
// COMPOSANT LIGNE DE CONNEXION
// ============================================

const ConnectionLine = ({ fromPos, toPos }) => {
  if (!fromPos || !toPos) return null;
  
  // Calculer les points de connexion (bords des nœuds)
  const dx = toPos.x - fromPos.x;
  const dy = toPos.y - fromPos.y;
  const angle = Math.atan2(dy, dx);
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Points de départ et d'arrivée (aux bords des nœuds)
  const startOffset = NODE_WIDTH / 2 + 5;
  const endOffset = NODE_WIDTH / 2 + 5;
  
  const startX = fromPos.x + startOffset * Math.cos(angle);
  const startY = fromPos.y + startOffset * Math.sin(angle);
  const endX = toPos.x - endOffset * Math.cos(angle);
  const endY = toPos.y - endOffset * Math.sin(angle);
  
  const lineLength = Math.max(0, distance - startOffset - endOffset);
  
  if (lineLength <= 0) return null;
  
  return (
    <div
      className="absolute bg-gradient-to-r from-slate-500 to-slate-400 rounded-full pointer-events-none"
      style={{
        width: lineLength,
        height: 3,
        left: startX,
        top: startY,
        transform: `rotate(${angle * (180 / Math.PI)}deg)`,
        transformOrigin: '0% 50%',
      }}
    />
  );
};

// ============================================
// COMPOSANT NŒUD DRAGGABLE
// ============================================

const DraggableNode = ({ 
  node, 
  position,
  onUpdateLabel, 
  onAdd, 
  onDelete, 
  onDragStart,
  onDrag,
  onDragEnd,
  isDragging,
  level = 0,
  scale = 1,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const nodeRef = useRef(null);
  
  // Palette de couleurs par niveau
  const colors = [
    "bg-blue-600 border-blue-800 shadow-blue-500/20",
    "bg-indigo-500 border-indigo-700 shadow-indigo-500/20",
    "bg-purple-500 border-purple-700 shadow-purple-500/20",
    "bg-pink-500 border-pink-700 shadow-pink-500/20",
    "bg-rose-400 border-rose-600 shadow-rose-500/20",
    "bg-orange-400 border-orange-600 shadow-orange-500/20",
    "bg-amber-400 border-amber-600 shadow-amber-500/20",
  ];
  const colorClass = colors[Math.min(level, colors.length - 1)];
  
  const isRoot = level === 0;
  
  const handleMouseDown = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.closest('button')) return;
    e.stopPropagation();
    onDragStart(node.id, e.clientX, e.clientY);
  };
  
  return (
    <div
      ref={nodeRef}
      className={`
        absolute flex flex-col items-center justify-center 
        px-3 py-2 rounded-xl shadow-lg border-b-4 
        transition-shadow duration-200
        ${colorClass} text-white
        ${isDragging ? 'cursor-grabbing shadow-2xl z-50 opacity-90' : 'cursor-grab'}
      `}
      style={{
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        left: position.x - NODE_WIDTH / 2,
        top: position.y - NODE_HEIGHT / 2,
        zIndex: isDragging ? 1000 : 10,
      }}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Poignée de drag */}
      <div className={`
        absolute -left-1 top-1/2 -translate-y-1/2 p-1 rounded
        transition-opacity duration-200
        ${isHovered && !isDragging ? 'opacity-60' : 'opacity-0'}
      `}>
        <Grip size={12} />
      </div>
      
      <input
        type="text"
        value={node.label}
        onChange={(e) => onUpdateLabel(node.id, e.target.value)}
        className="bg-transparent text-center outline-none w-full font-semibold placeholder-white/70 text-sm cursor-text"
        placeholder="Idée..."
        onClick={(e) => e.stopPropagation()}
      />

      {/* Boutons d'action */}
      <div 
        className={`
          absolute flex gap-1 transition-all duration-200
          ${isHovered && !isDragging ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}
          ${isRoot ? '-bottom-5 left-1/2 -translate-x-1/2' : '-top-4 -right-2'}
        `}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onAdd(node.id); }}
          className="p-1.5 bg-green-500 hover:bg-green-400 text-white rounded-full shadow-lg transition-colors border-2 border-white/80"
          title="Ajouter une branche"
        >
          <Plus size={12} />
        </button>
        {!isRoot && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
            className="p-1.5 bg-red-500 hover:bg-red-400 text-white rounded-full shadow-lg transition-colors border-2 border-white/80"
            title="Supprimer"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================
// COMPOSANT PRINCIPAL : MINDMAPAPP
// ============================================

export default function MindMapApp() {
  // Données de l'arbre
  const defaultData = {
    id: 'root',
    label: 'Idée Centrale',
    children: [
      {
        id: '1',
        label: 'Concept A',
        children: [
          { id: '1-1', label: 'Détail A.1', children: [] },
          { id: '1-2', label: 'Détail A.2', children: [] },
          { id: '1-3', label: 'Détail A.3', children: [] }
        ]
      },
      { 
        id: '2', 
        label: 'Concept B', 
        children: [
          { id: '2-1', label: 'Détail B.1', children: [] }
        ] 
      },
      { id: '3', label: 'Concept C', children: [] },
      {
        id: '4',
        label: 'Concept D',
        children: [
          { id: '4-1', label: 'Détail D.1', children: [] },
          { id: '4-2', label: 'Détail D.2', children: [] }
        ]
      },
      { id: '5', label: 'Concept E', children: [] }
    ]
  };

  const [treeData, setTreeData] = useState(defaultData);
  const [nodePositions, setNodePositions] = useState(() => calculateInitialPositions(defaultData));
  
  // État du canvas (pan & zoom)
  const [scale, setScale] = useState(0.9);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  
  // État du drag de nœud
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  // Centrer le canvas au chargement
  useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCanvasOffset({ 
        x: rect.width / 2, 
        y: rect.height / 2 
      });
    }
  }, []);

  // ============================================
  // GESTION DE L'ARBRE (CRUD)
  // ============================================
  
  const addNode = useCallback((parentId) => {
    const newId = generateId();
    const newNode = { id: newId, label: 'Nouvelle Idée', children: [] };
    
    const addNodeRecursive = (node) => 
      node.id === parentId
        ? { ...node, children: [...node.children, newNode] }
        : { ...node, children: node.children.map(addNodeRecursive) };
    
    const newTreeData = addNodeRecursive(treeData);
    setTreeData(newTreeData);
    
    // Calculer position pour le nouveau nœud (proche du parent)
    const parentPos = nodePositions[parentId];
    if (parentPos) {
      const siblingCount = (() => {
        const findNode = (n) => {
          if (n.id === parentId) return n.children.length;
          for (const child of n.children) {
            const result = findNode(child);
            if (result !== null) return result;
          }
          return null;
        };
        return findNode(newTreeData) || 1;
      })();
      
      const angle = (siblingCount - 1) * (Math.PI / 8);
      const newX = parentPos.x + SUB_BRANCH_RADIUS * Math.cos(angle);
      const newY = parentPos.y + SUB_BRANCH_RADIUS * Math.sin(angle);
      
      setNodePositions(prev => ({
        ...prev,
        [newId]: { x: newX, y: newY }
      }));
    }
  }, [treeData, nodePositions]);

  const updateNodeLabel = useCallback((nodeId, newLabel) => {
    const updateRecursive = (node) => 
      node.id === nodeId
        ? { ...node, label: newLabel }
        : { ...node, children: node.children.map(updateRecursive) };
    
    setTreeData(updateRecursive(treeData));
  }, [treeData]);

  const deleteNode = useCallback((nodeId) => {
    if (nodeId === 'root') return;
    
    // Collecter tous les IDs à supprimer (nœud + descendants)
    const collectIds = (node) => {
      let ids = [node.id];
      if (node.children) {
        node.children.forEach(child => {
          ids = [...ids, ...collectIds(child)];
        });
      }
      return ids;
    };
    
    const findNode = (node, id) => {
      if (node.id === id) return node;
      for (const child of node.children) {
        const found = findNode(child, id);
        if (found) return found;
      }
      return null;
    };
    
    const nodeToDelete = findNode(treeData, nodeId);
    const idsToDelete = nodeToDelete ? collectIds(nodeToDelete) : [nodeId];
    
    const deleteRecursive = (node) => ({
      ...node,
      children: node.children
        .filter(child => child.id !== nodeId)
        .map(deleteRecursive)
    });
    
    setTreeData(deleteRecursive(treeData));
    
    // Supprimer les positions
    setNodePositions(prev => {
      const newPositions = { ...prev };
      idsToDelete.forEach(id => delete newPositions[id]);
      return newPositions;
    });
  }, [treeData]);

  const resetMap = () => {
    if (window.confirm("Réinitialiser la carte ? Toutes les modifications seront perdues.")) {
      setTreeData(defaultData);
      setNodePositions(calculateInitialPositions(defaultData));
      setScale(0.9);
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCanvasOffset({ x: rect.width / 2, y: rect.height / 2 });
      }
    }
  };

  // ============================================
  // GESTION DU DRAG DES NŒUDS
  // ============================================
  
  const handleNodeDragStart = useCallback((nodeId, clientX, clientY) => {
    const nodePos = nodePositions[nodeId];
    if (!nodePos) return;
    
    // Calculer l'offset entre le clic et la position du nœud
    const canvasX = (clientX - canvasOffset.x) / scale;
    const canvasY = (clientY - canvasOffset.y) / scale;
    
    setDraggingNodeId(nodeId);
    setDragOffset({
      x: canvasX - nodePos.x,
      y: canvasY - nodePos.y
    });
  }, [nodePositions, canvasOffset, scale]);

  const handleNodeDrag = useCallback((clientX, clientY) => {
    if (!draggingNodeId) return;
    
    const canvasX = (clientX - canvasOffset.x) / scale;
    const canvasY = (clientY - canvasOffset.y) / scale;
    
    setNodePositions(prev => ({
      ...prev,
      [draggingNodeId]: {
        x: canvasX - dragOffset.x,
        y: canvasY - dragOffset.y
      }
    }));
  }, [draggingNodeId, canvasOffset, scale, dragOffset]);

  const handleNodeDragEnd = useCallback(() => {
    setDraggingNodeId(null);
  }, []);

  // ============================================
  // GESTION DU PAN & ZOOM DU CANVAS
  // ============================================
  
  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScale(s => Math.min(Math.max(s + delta, 0.2), 2.5));
    }
  };

  const handleCanvasMouseDown = (e) => {
    // Ne pas commencer le pan si on drag un nœud
    if (draggingNodeId) return;
    if (e.target.tagName === 'INPUT' || e.target.closest('button')) return;
    
    setIsPanning(true);
    setPanStart({ 
      x: e.clientX - canvasOffset.x, 
      y: e.clientY - canvasOffset.y 
    });
  };

  const handleMouseMove = (e) => {
    if (draggingNodeId) {
      handleNodeDrag(e.clientX, e.clientY);
    } else if (isPanning) {
      setCanvasOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handleMouseUp = () => {
    if (draggingNodeId) {
      handleNodeDragEnd();
    }
    setIsPanning(false);
  };

  // ============================================
  // COLLECTE DES DONNÉES POUR LE RENDU
  // ============================================
  
  // Aplatir l'arbre pour le rendu
  const flattenTree = (node, level = 0, nodes = []) => {
    nodes.push({ ...node, level });
    if (node.children) {
      node.children.forEach(child => flattenTree(child, level + 1, nodes));
    }
    return nodes;
  };
  
  const allNodes = flattenTree(treeData);
  const connections = collectConnections(treeData);

  // ============================================
  // RENDU
  // ============================================
  
  return (
    <div className="h-screen w-full bg-slate-900 flex flex-col font-sans overflow-hidden">
      
      {/* ===== BARRE D'OUTILS ===== */}
      <div className="bg-slate-800/95 backdrop-blur border-b border-slate-700 p-3 shadow-xl flex items-center justify-between z-50">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2.5 rounded-xl text-white shadow-lg shadow-blue-500/20">
            <Move size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              MindMap Draggable
            </h1>
            <p className="text-xs text-slate-500">Glissez les nœuds pour les repositionner</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm text-slate-400">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-700/50 rounded-lg text-xs">
            <span className="text-blue-400">⬤</span> Glisser nœud
            <span className="mx-1 text-slate-600">|</span>
            <span className="text-green-400">⬤</span> Glisser fond = pan
            <span className="mx-1 text-slate-600">|</span>
            <span className="text-purple-400">⬤</span> Ctrl+Molette = zoom
          </div>
          
          <div className="h-8 w-px bg-slate-600" />
          
          <div className="flex items-center gap-1 bg-slate-700/50 rounded-lg p-1">
            <button 
              onClick={() => setScale(s => Math.max(s - 0.1, 0.2))} 
              className="p-1.5 hover:bg-slate-600 rounded transition-colors text-slate-300"
            >
              <ZoomOut size={16} />
            </button>
            <span className="w-12 text-center font-mono text-xs text-slate-300">
              {Math.round(scale * 100)}%
            </span>
            <button 
              onClick={() => setScale(s => Math.min(s + 0.1, 2.5))} 
              className="p-1.5 hover:bg-slate-600 rounded transition-colors text-slate-300"
            >
              <ZoomIn size={16} />
            </button>
          </div>
          
          <button
            onClick={resetMap}
            className="flex items-center gap-1.5 px-3 py-1.5 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors text-sm"
          >
            <RotateCcw size={14} />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* ===== ZONE DE CANEVAS ===== */}
      <div
        ref={containerRef}
        className={`
          flex-1 overflow-hidden relative
          ${draggingNodeId ? 'cursor-grabbing' : isPanning ? 'cursor-grabbing' : 'cursor-grab'}
        `}
        style={{
          background: `
            radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.05) 0%, transparent 50%),
            linear-gradient(to bottom, #0f172a, #1e293b)
          `,
        }}
        onWheel={handleWheel}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Grille de fond */}
        <div 
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(148, 163, 184, 0.2) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            backgroundPosition: `${canvasOffset.x % 20}px ${canvasOffset.y % 20}px`
          }}
        />
        
        {/* Canvas transformé */}
        <div
          ref={canvasRef}
          className="absolute origin-top-left"
          style={{
            transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${scale})`,
          }}
        >
          {/* Lignes de connexion */}
          {connections.map(({ from, to }) => (
            <ConnectionLine
              key={`${from}-${to}`}
              fromPos={nodePositions[from]}
              toPos={nodePositions[to]}
            />
          ))}
          
          {/* Nœuds */}
          {allNodes.map(node => (
            <DraggableNode
              key={node.id}
              node={node}
              position={nodePositions[node.id] || { x: 0, y: 0 }}
              level={node.level}
              scale={scale}
              isDragging={draggingNodeId === node.id}
              onUpdateLabel={updateNodeLabel}
              onAdd={addNode}
              onDelete={deleteNode}
              onDragStart={handleNodeDragStart}
              onDrag={handleNodeDrag}
              onDragEnd={handleNodeDragEnd}
            />
          ))}
        </div>
      </div>

      {/* ===== PANNEAU D'AIDE ===== */}
      <div className="absolute bottom-4 right-4 bg-slate-800/90 backdrop-blur-sm p-4 rounded-xl shadow-2xl border border-slate-700 max-w-xs pointer-events-none z-40">
        <h3 className="font-semibold mb-2 text-slate-200 text-sm flex items-center gap-2">
          <Grip size={14} className="text-blue-400" />
          Drag & Drop activé
        </h3>
        <ul className="space-y-1.5 text-slate-400 text-xs">
          <li>• <span className="text-blue-300">Glissez</span> un nœud pour le déplacer</li>
          <li>• <span className="text-green-300">+</span> ajoute un enfant</li>
          <li>• Les lignes suivent automatiquement</li>
        </ul>
      </div>

      {/* ===== LÉGENDE DES NIVEAUX ===== */}
      <div className="absolute bottom-4 left-4 bg-slate-800/90 backdrop-blur-sm px-3 py-2 rounded-xl shadow-xl border border-slate-700 pointer-events-none z-40">
        <div className="flex gap-1.5 items-center">
          <span className="text-[10px] text-slate-500 mr-1">Niveaux:</span>
          {['bg-blue-600', 'bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 'bg-rose-400', 'bg-orange-400'].map((c, i) => (
            <div key={i} className={`w-3 h-3 rounded ${c}`} title={`Niveau ${i}`} />
          ))}
        </div>
      </div>
    </div>
  );
}