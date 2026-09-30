import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

function App() {
    const [leftItems, setLeftItems] = useState([]);
    const [rightItems, setRightItems] = useState([]);

    const [leftFilter, setLeftFilter] = useState('');
    const [rightFilter, setRightFilter] = useState('');

    const [leftPage, setLeftPage] = useState(1);
    const [rightPage, setRightPage] = useState(1);

    const [hasMoreLeft, setHasMoreLeft] = useState(true);
    const [hasMoreRight, setHasMoreRight] = useState(true);

    const [newIdInput, setNewIdInput] = useState('');
    const [draggedId, setDraggedId] = useState(null);

    const [isLoading, setIsLoading] = useState(false);
    const [pendingIds, setPendingIds] = useState(new Map());

    const leftScrollContainer = useRef(null);
    const rightScrollContainer = useRef(null);

    const loadData = useCallback(async (isScrollAction = false) => {
        if (isScrollAction) {
            setIsLoading(true);
        }
        try {
            const res = await fetch('/api/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leftFilter, rightFilter, leftPage, rightPage })
            });
            const data = await res.json();
            if (data && !data.duplicate) {
                setLeftItems(data.leftItems || []);
                setRightItems(data.rightItems || []);
                setHasMoreLeft(data.hasMoreLeft);
                setHasMoreRight(data.hasMoreRight);
            }
        } catch (e) {
        } finally {
            if (isScrollAction) {
                setIsLoading(false);
            }
        }
    }, [leftFilter, rightFilter, leftPage, rightPage]);

    useEffect(() => {
        loadData(false);
        const interval = setInterval(() => {
            loadData(false);
        }, 1000);
        return () => clearInterval(interval);
    }, [loadData]);

    useEffect(() => {
        setLeftPage(1);
    }, [leftFilter]);

    useEffect(() => {
        setRightPage(1);
    }, [rightFilter]);

    const handleLeftScroll = () => {
        if (isLoading || !hasMoreLeft || !leftScrollContainer.current) return;

        const { scrollTop, scrollHeight, clientHeight } = leftScrollContainer.current;
        if (scrollHeight - scrollTop <= clientHeight + 50) {
            setLeftPage(prev => prev + 1);
            loadData(true);
        }
    };

    const handleRightScroll = () => {
        if (isLoading || !hasMoreRight || !rightScrollContainer.current) return;

        const { scrollTop, scrollHeight, clientHeight } = rightScrollContainer.current;
        if (scrollHeight - scrollTop <= clientHeight + 50) {
            setRightPage(prev => prev + 1);
            loadData(true);
        }
    };

    const handleAddItem = async (e) => {
        e.preventDefault();
        if (!newIdInput) return;
        try {
            const res = await fetch('/api/items/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: newIdInput })
            });
            if (res.ok) {
                setNewIdInput('');
            } else {
                const err = await res.json();
                alert(err.error || 'Error');
            }
        } catch (e) { }
    };

    const selectItem = async (id) => {
        setPendingIds(prev => {
            const next = new Map(prev);
            next.set(id, 'select');
            return next;
        });

        try {
            await fetch('/api/selection/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'select', id })
            });
        } catch (e) { }
    };

    const unselectItem = async (id) => {
        setPendingIds(prev => {
            const next = new Map(prev);
            next.set(id, 'unselect');
            return next;
        });

        try {
            await fetch('/api/selection/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'unselect', id })
            });
        } catch (e) { }
    };

    const handleDragStart = (id) => {
        setDraggedId(id);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDrop = async (targetId) => {
        if (draggedId === null || draggedId === targetId) return;

        const currentRightIds = rightItems.map(item => item.id);
        const draggedIndex = currentRightIds.indexOf(draggedId);
        const targetIndex = currentRightIds.indexOf(targetId);

        if (draggedIndex === -1 || targetIndex === -1) return;

        const updatedIds = [...currentRightIds];
        updatedIds.splice(draggedIndex, 1);
        updatedIds.splice(targetIndex, 0, draggedId);

        setRightItems(prev => {
            const copy = [...prev];
            const draggedItem = copy.find(item => item.id === draggedId);
            if (!draggedItem) return prev;

            const filtered = copy.filter(item => item.id !== draggedId);
            const idx = filtered.findIndex(item => item.id === targetId);
            filtered.splice(idx, 0, draggedItem);
            return filtered;
        });

        try {
            await fetch('/api/selection/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reorder', orderIds: updatedIds })
            });
        } catch (e) { }
        setDraggedId(null);
    };

    useEffect(() => {
        if (pendingIds.size === 0) return;

        setPendingIds(prev => {
            const next = new Map(prev);
            let changed = false;

            for (const [id, action] of next.entries()) {
                const inLeft = leftItems.some(item => item.id === id);
                const inRight = rightItems.some(item => item.id === id);

                if (action === 'select' && inRight) {
                    next.delete(id);
                    changed = true;
                } else if (action === 'unselect' && inLeft) {
                    next.delete(id);
                    changed = true;
                }
            }

            return changed ? next : prev;
        });
    }, [leftItems, rightItems, pendingIds]);

    const displayLeftItems = leftItems
        .filter(item => !pendingIds.has(item.id))
        .concat(
            Array.from(pendingIds.entries())
                .filter(([_, action]) => action === 'unselect')
                .map(([id]) => ({ id, selected: false }))
        )
        .filter((item, index, self) => self.findIndex(t => t.id === item.id) === index)
        .sort((a, b) => Number(a.id) - Number(b.id));

    const displayRightItems = rightItems
        .filter(item => !pendingIds.has(item.id))
        .concat(
            Array.from(pendingIds.entries())
                .filter(([_, action]) => action === 'select')
                .map(([id]) => ({ id, selected: true }))
        )
        .filter((item, index, self) => self.findIndex(t => t.id === item.id) === index);

    return (
        <div className="app-container">
            <div className="container-box">
                <h3>Левый контейнер</h3>
                <input
                    type="text"
                    placeholder="Фильтр по ID"
                    value={leftFilter}
                    onChange={e => setLeftFilter(e.target.value)}
                />
                <form onSubmit={handleAddItem} style={{ margin: '10px 0' }}>
                    <input
                        type="number"
                        placeholder="Добавить новый ID"
                        value={newIdInput}
                        onChange={e => setNewIdInput(e.target.value)}
                    />
                    <button type="submit">Добавить</button>
                </form>
                <div
                    className="list-scroll"
                    ref={leftScrollContainer}
                    onScroll={handleLeftScroll}
                >
                    {displayLeftItems.map(item => (
                        <div key={`left-${item.id}`} className="item-row" onClick={() => selectItem(item.id)}>
                            ID: {item.id}
                        </div>
                    ))}
                    <div style={{ height: '30px', padding: '5px', textAlign: 'center', color: '#888' }}>
                        {hasMoreLeft ? 'Загрузка следующих элементов...' : 'Конец списка'}
                    </div>
                </div>
            </div>

            <div className="container-box">
                <h3>Правый контейнер</h3>
                <input
                    type="text"
                    placeholder="Фильтр по ID"
                    value={rightFilter}
                    onChange={e => setRightFilter(e.target.value)}
                />
                <div
                    className="list-scroll"
                    ref={rightScrollContainer}
                    onScroll={handleRightScroll}
                    style={{ marginTop: '50px' }}
                >
                    {displayRightItems.map(item => (
                        <div
                            key={`right-${item.id}`}
                            className="item-row drag-item"
                            draggable
                            onDragStart={() => handleDragStart(item.id)}
                            onDragOver={handleDragOver}
                            onDrop={() => handleDrop(item.id)}
                            onClick={() => unselectItem(item.id)}
                        >
                            ID: {item.id}
                        </div>
                    ))}
                    <div style={{ height: '30px', padding: '5px', textAlign: 'center', color: '#888' }}>
                        {hasMoreRight ? 'Загрузка следующих элементов...' : 'Конец списка'}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;
