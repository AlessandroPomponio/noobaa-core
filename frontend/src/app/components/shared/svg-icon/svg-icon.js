import template from './svg-icon.html';
import Disposable from 'disposable';
import ko from 'knockout';
import { realizeUri } from 'utils/all';
import { asset as assetsRoute } from 'routes';
import { defaultIconFile } from 'config.json';

class SVGIconViewModel extends Disposable {
    constructor({ name, asset = defaultIconFile, fill, stroke }) {
        super();

        this.href = ko.pureComputed(
            () => `${
                realizeUri(assetsRoute, { asset: ko.unwrap(asset) })
            }#${
                ko.unwrap(name)
            }`
        );
        this.fill = fill;
        this.stroke = stroke;

    }
}

export default {
    viewModel: SVGIconViewModel,
    template: template
};
