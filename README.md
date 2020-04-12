# userscripts
A collection of home-made user scripts for navigator extensions such as Tapermonkey

# installation
1. Get a script manager extension such as Tapermonkey or Greasemonkey.
2. Add the scripts of this repo in the extension's menus
3. ???
4. Profit!

# current scripts

## page-cleaner

A page cleaner utility, enabling you to highlight-on-hover sections of visited html pages, and delete them on the fly. 

Deleted sections will be saved as unwanted, and hidden again at your next visit. Config is saved by domain.

Currently, the toggle keyboard shortcut is hard coded, and is **Alt + Shift**. 
Holding those keys and moving the mouse cursor will highlight the page's elements. 
On click, the element will be hidden if possible (it must have an id or a class attribute), and saved as such in your plugin manager's local storage.

## enhance

[can you enhance that?](https://i.kym-cdn.com/entries/icons/original/000/018/512/emhance.jpg) Of course you can! This plugin parses the page on load, searching for image tags, or links pointing directly to images.

When hovering with your cursor on said elements, the corresponding full-res image will be displayed next to the cursor if available or currently scaled-down.

*be wary of cross-origin policy issues, though*
