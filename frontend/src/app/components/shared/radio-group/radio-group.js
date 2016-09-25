import template from './radio-group.html';
import Disposable from 'disposable';
import ko from 'knockout';
import { randomString } from 'utils';

class RadioGroupViewModel extends Disposable {
    constructor({
            selected = ko.observable(),
            name = randomString(5),
            options,
            multiline = false,
            disabled = false,
            hasFocus = false
    }) {
        super();

        this.name = name;
        this.selected = selected;
        this.options = options;
        this.disabled = disabled;
        this.hasFocus = hasFocus;
        this.layoutClass = multiline ? 'column' : 'row';
    }
}

export default {
    viewModel: RadioGroupViewModel,
    template: template
};
