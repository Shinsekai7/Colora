import type {BrowserCommand} from 'vitest/node';

type MouseAction = 'move' | 'down' | 'up';

declare module 'vitest/browser' {
    interface BrowserCommands {
        mouse: (action: MouseAction, x?: number, y?: number) => Promise<void>;
    }
}

/**
 * Drives the real mouse, so the browser produces trusted pointer events (and pointer capture works).
 * Coordinates are client coordinates inside the test iframe.
 */
export const mouse: BrowserCommand<[action: MouseAction, x?: number, y?: number]> = async (ctx, action, x = 0, y = 0) => {
    if (!('page' in ctx)) {
        throw new Error('The mouse command requires the playwright provider.');
    }

    const frame = await ctx.frame();
    const box = await (await frame.frameElement()).boundingBox();
    const innerWidth = await frame.evaluate(() => window.innerWidth);

    if (!box) {
        throw new Error('Test iframe is not visible.');
    }

    // The iframe may be scaled down to fit the browser window
    const scale = box.width / innerWidth;
    await ctx.page.mouse.move(box.x + x * scale, box.y + y * scale);

    if (action !== 'move') {
        await ctx.page.mouse[action]();
    }
};
