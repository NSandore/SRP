// src/components/TextEditor.js

import React, { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import {
  FaBold,
  FaItalic,
  FaUnderline,
  FaStrikethrough,
  FaListUl,
  FaListOl,
  FaHeading,
  FaLink,
  FaImage,
  FaAlignLeft,
  FaAlignCenter,
  FaAlignRight,
} from 'react-icons/fa';
import './TextEditor.css'; // Import custom styles for the editor and toolbar

const TextEditor = ({ value, onChange }) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false, // Prevent links from opening automatically
      }),
      Image.configure({
        inline: false,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'], // Apply alignment to headings and paragraphs
      }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html); // Pass the updated HTML to the parent component
    },
  });

  // Clean up the editor instance when the component unmounts
  useEffect(() => {
    return () => {
      if (editor) {
        editor.destroy();
      }
    };
  }, [editor]);

  // Toolbar Button Handler
  const handleButtonClick = (command, value = null) => {
    switch (command) {
      case 'toggleBold':
        editor.chain().focus().toggleBold().run();
        break;
      case 'toggleItalic':
        editor.chain().focus().toggleItalic().run();
        break;
      case 'toggleUnderline':
        editor.chain().focus().toggleUnderline().run();
        break;
      case 'toggleStrike':
        editor.chain().focus().toggleStrike().run();
        break;
      case 'toggleBulletList':
        editor.chain().focus().toggleBulletList().run();
        break;
      case 'toggleOrderedList':
        editor.chain().focus().toggleOrderedList().run();
        break;
      case 'toggleHeading':
        editor.chain().focus().toggleHeading({ level: value }).run();
        break;
      case 'addLink':
        const url = prompt('Enter the URL');
        if (url) {
          editor.chain().focus().setLink({ href: url }).run();
        }
        break;
      case 'unlink':
        editor.chain().focus().unsetLink().run();
        break;
      case 'addImage':
        const imageUrl = prompt('Enter the image URL');
        if (imageUrl) {
          editor.chain().focus().setImage({ src: imageUrl }).run();
        }
        break;
      case 'alignLeft':
        editor.chain().focus().setTextAlign('left').run();
        break;
      case 'alignCenter':
        editor.chain().focus().setTextAlign('center').run();
        break;
      case 'alignRight':
        editor.chain().focus().setTextAlign('right').run();
        break;
      default:
        break;
    }
  };

  // Check if a mark or node is active
  const isActive = (type, attributes = {}) => {
    return editor.isActive(type, attributes);
  };

  return (
    <div className="text-editor-container">
      {/* Toolbar */}
      <div className="toolbar">
        {/* Bold */}
        <button
          type="button"
          className={`toolbar-button ${isActive('bold') ? 'active' : ''}`}
          onClick={() => handleButtonClick('toggleBold')}
          title="Bold"
        >
          <FaBold />
        </button>

        {/* Italic */}
        <button
          type="button"
          className={`toolbar-button ${isActive('italic') ? 'active' : ''}`}
          onClick={() => handleButtonClick('toggleItalic')}
          title="Italic"
        >
          <FaItalic />
        </button>

        {/* Underline */}
        <button
          type="button"
          className={`toolbar-button ${isActive('underline') ? 'active' : ''}`}
          onClick={() => handleButtonClick('toggleUnderline')}
          title="Underline"
        >
          <FaUnderline />
        </button>

        {/* Strikethrough */}
        <button
          type="button"
          className={`toolbar-button ${isActive('strike') ? 'active' : ''}`}
          onClick={() => handleButtonClick('toggleStrike')}
          title="Strikethrough"
        >
          <FaStrikethrough />
        </button>

        {/* Bullet List */}
        <button
          type="button"
          className={`toolbar-button ${isActive('bulletList') ? 'active' : ''}`}
          onClick={() => handleButtonClick('toggleBulletList')}
          title="Bullet List"
        >
          <FaListUl />
        </button>

        {/* Ordered List */}
        <button
          type="button"
          className={`toolbar-button ${isActive('orderedList') ? 'active' : ''}`}
          onClick={() => handleButtonClick('toggleOrderedList')}
          title="Ordered List"
        >
          <FaListOl />
        </button>

        {/* Headings */}
        <select
          className="toolbar-select"
          onChange={(e) => handleButtonClick('toggleHeading', parseInt(e.target.value))}
          value={
            isActive('heading', { level: 1 })
              ? '1'
              : isActive('heading', { level: 2 })
              ? '2'
              : isActive('heading', { level: 3 })
              ? '3'
              : '0'
          }
          title="Headings"
        >
          <option value="0">Normal</option>
          <option value="1">Heading 1</option>
          <option value="2">Heading 2</option>
          <option value="3">Heading 3</option>
        </select>

        {/* Add Link */}
        <button
          type="button"
          className={`toolbar-button ${isActive('link') ? 'active' : ''}`}
          onClick={() => handleButtonClick('addLink')}
          title="Add Link"
        >
          <FaLink />
        </button>

        {/* Unlink */}
        {isActive('link') && (
          <button
            type="button"
            className="toolbar-button"
            onClick={() => handleButtonClick('unlink')}
            title="Remove Link"
          >
            ❌
          </button>
        )}

        {/* Add Image */}
        <button
          type="button"
          className="toolbar-button"
          onClick={() => handleButtonClick('addImage')}
          title="Add Image"
        >
          <FaImage />
        </button>

        {/* Text Alignment Buttons */}
        <button
          type="button"
          className={`toolbar-button ${isActive('textAlign', { align: 'left' }) ? 'active' : ''}`}
          onClick={() => handleButtonClick('alignLeft')}
          title="Align Left"
        >
          <FaAlignLeft />
        </button>

        <button
          type="button"
          className={`toolbar-button ${isActive('textAlign', { align: 'center' }) ? 'active' : ''}`}
          onClick={() => handleButtonClick('alignCenter')}
          title="Align Center"
        >
          <FaAlignCenter />
        </button>

        <button
          type="button"
          className={`toolbar-button ${isActive('textAlign', { align: 'right' }) ? 'active' : ''}`}
          onClick={() => handleButtonClick('alignRight')}
          title="Align Right"
        >
          <FaAlignRight />
        </button>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  );
};

export default TextEditor;
