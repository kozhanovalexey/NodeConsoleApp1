const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const TOTAL_ITEMS = 1000000;
const itemsDb = [];

for (let i = 1; i <= TOTAL_ITEMS; i++) {
    itemsDb.push({
        id: i,
        selected: false
    });
}

const addQueue = new Set();
let fetchMutateQueue = [];

setInterval(() => {
    if (addQueue.size === 0) return;

    const itemsToAdd = Array.from(addQueue);
    addQueue.clear();

    for (const id of itemsToAdd) {
        const exists = itemsDb.some(item => item.id === id);
        if (!exists) {
            itemsDb.push({
                id: id,
                selected: false
            });
        }
    }
}, 10000);

setInterval(() => {
    if (fetchMutateQueue.length === 0) return;

    const currentQueue = [...fetchMutateQueue];
    fetchMutateQueue = [];

    const selectionUpdates = currentQueue.filter(req => req.type === 'update_selection');

    if (selectionUpdates.length > 0) {
        for (const req of selectionUpdates) {
            const { action, id, orderIds } = req.data;

            if (action === 'select') {
                const item = itemsDb.find(i => i.id === id);
                if (item) {
                    item.selected = true;
                }
            } else if (action === 'unselect') {
                const item = itemsDb.find(i => i.id === id);
                if (item) {
                    item.selected = false;
                }
            } else if (action === 'reorder' && orderIds) {
                const orderMap = new Map();
                orderIds.forEach((orderId, index) => {
                    orderMap.set(orderId, index);
                });

                itemsDb.sort((a, b) => {
                    const aInOrder = orderMap.has(a.id);
                    const bInOrder = orderMap.has(b.id);

                    if (aInOrder && bInOrder) return orderMap.get(a.id) - orderMap.get(b.id);
                    if (aInOrder) return 1;
                    if (bInOrder) return -1;
                    return 0;
                });
            }
        }
    }

    for (const req of currentQueue) {
        if (req.type === 'get_data') {
            const { leftFilter, rightFilter, leftPage, rightPage } = req.data;

            const lFilterStr = leftFilter ? String(leftFilter) : '';
            const rFilterStr = rightFilter ? String(rightFilter) : '';

            const leftFiltered = [];
            const rightFiltered = [];

            for (let i = 0; i < itemsDb.length; i++) {
                const item = itemsDb[i];
                if (!item.selected) {
                    if (!lFilterStr || String(item.id).includes(lFilterStr)) {
                        leftFiltered.push(item);
                    }
                } else {
                    if (!rFilterStr || String(item.id).includes(rFilterStr)) {
                        rightFiltered.push(item);
                    }
                }
            }

            const leftLimit = leftPage * 20;
            const rightLimit = rightPage * 20;

            req.res.json({
                leftItems: leftFiltered.slice(0, leftLimit),
                rightItems: rightFiltered.slice(0, rightLimit),
                hasMoreLeft: leftFiltered.length > leftLimit,
                hasMoreRight: rightFiltered.length > rightLimit
            });
        } else if (req.type === 'update_selection') {
            req.res.json({ success: true });
        }
    }
}, 1000);

app.post('/api/items/add', (req, res) => {
    const { id } = req.body;
    const numericId = parseInt(id, 10);

    if (isNaN(numericId)) {
        return res.status(400).json({ error: 'Not valid ID' });
    }

    const existsInDb = itemsDb.some(item => item.id === numericId);
    if (existsInDb || addQueue.has(numericId)) {
        return res.status(400).json({ error: 'ID already exists' });
    }

    addQueue.add(numericId);
    res.json({ success: true, message: 'Added to processing queue' });
});

app.post('/api/data', (req, res) => {
    const { leftFilter, rightFilter, leftPage, rightPage } = req.body;

    fetchMutateQueue.push({
        type: 'get_data',
        data: { leftFilter, rightFilter, leftPage, rightPage },
        res: res
    });
});

app.post('/api/selection/update', (req, res) => {
    const { action, id, orderIds } = req.body;

    fetchMutateQueue.push({
        type: 'update_selection',
        data: { action, id, orderIds },
        res: res
    });
});

app.listen(5000, () => {
    console.log('Server runs on port 5000');
});
