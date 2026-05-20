export function cleanLinks(text: string): string{
    return text
        .replace(
            /\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g,
            (_match, target, alias) => {
                if (alias) return alias;
                const basename = target.split('/').pop() ?? target;
                return basename.replace(/\.md$/, '');
            }
        )
    }