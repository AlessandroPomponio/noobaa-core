import template from './pool-summary.html';
import Disposable from 'disposable';
import ko from 'knockout';
import moment from 'moment';
import numeral from 'numeral';
import style from 'style';
import { formatSize } from 'utils';

const activityLabelMapping = Object.freeze({
    EVACUATING: 'Evacuating',
    REBUILDING: 'Rebuilding',
    MIGRATING: 'Migrating'
});

function mapActivity({ reason, node_count, completed_size, total_size, eta }) {
    return {
        row1: `${
            activityLabelMapping[reason]
        } ${
            node_count
        } nodes | Completed ${
            formatSize(completed_size)
        } of ${
            formatSize(total_size)
        }`,

        row2: `(${
            numeral(completed_size / total_size).format('0%')
        } completed, ETA: ${
            moment().to(eta)
        })`
    };
}

class PoolSummaryViewModel extends Disposable {
    constructor({ pool }) {
        super();

        this.dataReady = ko.pureComputed(
            () => !!pool()
        );

        this.total = ko.pureComputed(
            () => pool().storage.total
        );

        this.totalText = ko.pureComputed(
            () => formatSize(this.total())
        );

        this.used = ko.pureComputed(
            () => pool().storage.used
        );

        this.usedText = ko.pureComputed(
            () => formatSize(this.used())
        );

        this.free = ko.pureComputed(
            () => pool().storage.free
        );

        this.freeText = ko.pureComputed(
            () => formatSize(this.free())
        );

        this.pieValues = [
            {
                value: this.used,
                color: style['text-color6']
            },
            {
                value: this.free,
                color: style['text-color4']
            }
        ];

        let onlineCount = ko.pureComputed(
            () => pool().nodes.online
        );

        let healthy = ko.pureComputed(
            () => onlineCount() >= 3
        );

        this.stateText = ko.pureComputed(
            () => healthy() ? 'Healthy' : 'Not enough online nodes'
        );

        this.stateIcon = ko.pureComputed(
            () => `pool-${healthy() ? 'healthy' : 'problem'}`
        );

        this.nodeCount = ko.pureComputed(
            () => pool().nodes.count
        );

        this.onlineIcon = ko.pureComputed(
            () => `node-${onlineCount() > 0 ? 'online' : 'online'}`
        );

        this.onlineText = ko.pureComputed(
            () => `${
                onlineCount() > 0 ?  numeral(onlineCount()).format('0,0') : 'No'
            } Online`
        );

        let offlineCount = ko.pureComputed(
            () => pool().nodes.count - pool().nodes.online
        );

        this.offlineIcon = ko.pureComputed(
            () => `node-${onlineCount() > 0 ? 'offline' : 'offline'}`
        );

        this.offlineText = ko.pureComputed(
            () => `${
                offlineCount() > 0 ?  numeral(offlineCount()).format('0,0') : 'No'
            } Offline`
        );

        this.offlineText = ko.pureComputed(
            () => {
                let count = pool().nodes.count - pool().nodes.online;
                return `${count > 0 ? numeral(count).format('0,0') : 'No'} Offline`;
            }
        );

        this.dataActivities = ko.pureComputed(
            () => pool().data_activities && pool().data_activities.map(mapActivity)
        );
    }
}

export default {
    viewModel: PoolSummaryViewModel,
    template: template
};
