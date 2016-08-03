import Disposable from 'disposable';
import ko from 'knockout';
import { shortString, formatSize } from 'utils';

const partStateMapping = Object.freeze({
    available: { tooltip: 'available', icon: 'part-available' },
    building:  { tooltip: 'in process', icon: 'part-in-process' },
    unavailable: { tooltip: 'unavailable', icon: 'part-unavailable' }
});

class BlockRowViewModel extends Disposable {
    constructor({ adminfo }, index, count) {
        super();

        let { online, node_ip, node_name, pool_name } = adminfo;

        this.label = `Replica ${index + 1} of ${count}`;
        this.nodeStateTooltip = online ? 'online' : 'offline';
        this.nodeStateIcon = `node-${online ? 'online' : 'offline'}`;
        this.nodeIp = node_ip;
        this.poolName = pool_name;
        this.nodeName = node_name;
        this.shortenNodeName = shortString(node_name);
    }
}

export default class ObjectPartRowViewModel extends Disposable {
    constructor(part, partNumber, partsCount) {
        super();

        let size = formatSize(part.chunk.size);
        let state = part.chunk.adminfo.health;
        let blocks = part.chunk.frags[0].blocks;
        let stateMapping = partStateMapping[state];

        this.stateTooltip = stateMapping.tooltip;
        this.stateIcon = stateMapping.icon;
        this.name = `Part ${partNumber + 1} of ${partsCount}`;
        this.size = size;
        this.blocks = blocks;
        this.blocks = blocks.map(
            (block, i) =>  new BlockRowViewModel(block, i, blocks.length)
        );

        this.isExpended = ko.observable(partsCount === 1);
    }

    toggleExpend() {
        this.isExpended(!this.isExpended());
    }
}
