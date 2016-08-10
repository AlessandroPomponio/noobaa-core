import Disposable from 'disposable';
import ko from 'knockout';
import { deepFreeze, formatSize } from 'utils';
import { deleteCloudResource } from 'actions';

const undeletableReasons = Object.freeze({
    IN_USE: 'Cannot delete a resource which is used in a bucket cloud storage policy'
});

const icons = deepFreeze([
    {
        pattern: 's3.amazonaws.com',
        icon: 'amazon-resource'
    },
    {
        pattern: 'storage.googleapis.com',
        icon: 'google-resource'
    },
    {
        pattern: '',
        icon: 'cloud-resource'
    }
]);

export default class CloudResourceRowViewModel extends Disposable {
    constructor(resource, deleteGroup) {
        super();

        this.type = ko.pureComputed(
            () => {
                if (!resource()) {
                    return;
                }

                let endpoint = resource().cloud_info.endpoint.toLowerCase();
                let { icon } = icons.find(
                    ({ pattern }) => endpoint.indexOf(pattern) > -1
                );

                return icon;
            }
        );

        this.name = ko.pureComputed(
            () => resource() && resource().name
        );

        this.usage = ko.pureComputed(
            () => resource() && formatSize(resource().storage.used)
        );

        this.cloudBucket = ko.pureComputed(
            () => resource() && resource().cloud_info.target_bucket
        );

        let undeletable = ko.pureComputed(
            () => resource() && resource().undeletable
        );

        this.deleteBtn = {
            subject: 'resrouces',
            group: deleteGroup,
            undeletable: undeletable,
            deleteTooltip: ko.pureComputed(
                () => undeletable() ? undeletableReasons[undeletable()] : 'delete resources'
            ),
            onDelete: () => this.del()
        };

    }

    del() {
        deleteCloudResource(this.name());
    }
}
