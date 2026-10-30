// src/components/TextEditor.js

import React, { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import {
  FaBold,
  FaCode,
  FaEraser,
  FaItalic,
  FaUnderline,
  FaStrikethrough,
  FaListUl,
  FaListOl,
  FaLink,
  FaImage,
  FaAlignLeft,
  FaAlignCenter,
  FaAlignRight,
  FaMinus,
  FaQuoteRight,
  FaRedo,
  FaUndo,
} from 'react-icons/fa';
import { getPlainTextLength } from '../utils/contentLimits';
import './TextEditor.css'; // Import custom styles for the editor and toolbar

const TextEditor = ({ value, onChange, maxLength = null }) => {
  const normalizedMaxLength = Number(maxLength) > 0 ? Number(maxLength) : null;
  const lastAcceptedHtmlRef = useRef(value || '');
  const [characterCount, setCharacterCount] = useState(() => getPlainTextLength(value));

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
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
      const nextCharacterCount = editor.getText().trim().length;
      if (normalizedMaxLength && nextCharacterCount > normalizedMaxLength) {
        editor.commands.setContent(lastAcceptedHtmlRef.current || '', false);
        setCharacterCount(getPlainTextLength(lastAcceptedHtmlRef.current));
        return;
      }
      lastAcceptedHtmlRef.current = html;
      setCharacterCount(nextCharacterCount);
      onChange(html); // Pass the updated HTML to the parent component
    },
  });

  useEffect(() => {
    if (!editor) return;
    const nextValue = value || '';
    if (nextValue === lastAcceptedHtmlRef.current) return;
    const nextCharacterCount = getPlainTextLength(nextValue);
    if (normalizedMaxLength && nextCharacterCount > normalizedMaxLength) return;
    lastAcceptedHtmlRef.current = nextValue;
    setCharacterCount(nextCharacterCount);
    if (editor.getHTML() !== nextValue) {
      editor.commands.setContent(nextValue, false);
    }
  }, [editor, normalizedMaxLength, value]);

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
        if (value === 0) {
          editor.chain().focus().setParagraph().run();
        } else {
          editor.chain().focus().toggleHeading({ level: value }).run();
        }
        break;
      case 'toggleBlockquote':
        editor.chain().focus().toggleBlockquote().run();
        break;
      case 'toggleCodeBlock':
        editor.chain().focus().toggleCodeBlock().run();
        break;
      case 'setHorizontalRule':
        editor.chain().focus().setHorizontalRule().run();
        break;
      case 'clearFormatting':
        editor.chain().focus().unsetAllMarks().clearNodes().run();
        break;
      case 'undo':
        editor.chain().focus().undo().run();
        break;
      case 'redo':
        editor.chain().focus().redo().run();
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
          aria-label="Bold"
        >
          <FaBold />
        </button>

        {/* Italic */}
        <button
          type="button"
          className={`toolbar-button ${isActive('italic') ? 'active' : ''}`}
          onClick={() => handleButtonClick('toggleItalic')}
          title="Italic"
          aria-label="Italic"
        >
          <FaItalic />
        </button>

        {/* Underline */}
        <button
          type="button"
          className={`toolbar-button ${isActive('underline') ? 'active' : ''}`}
          onClick={() => handleButtonClick('toggleUnderline')}
          title="Underline"
          aria-label="Underline"
        >
          <FaUnderline />
        </button>

        {/* Strikethrough */}
        <button
          type="button"
          className={`toolbar-button ${isActive('strike') ? 'active' : ''}`}
          onClick={() => handleButtonClick('toggleStrike')}
          title="Strikethrough"
          aria-label="Strikethrough"
        >
          <FaStrikethrough />
        </button>

        {/* Bullet List */}
        <button
          type="button"
          className={`toolbar-button ${isActive('bulletList') ? 'active' : ''}`}
          onClick={() => handleButtonClick('toggleBulletList')}
          title="Bullet List"
          aria-label="Bullet list"
        >
          <FaListUl />
        </button>

        {/* Ordered List */}
        <button
          type="button"
          className={`toolbar-button ${isActive('orderedList') ? 'active' : ''}`}
          onClick={() => handleButtonClick('toggleOrderedList')}
          title="Ordered List"
          aria-label="Numbered list"
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
          aria-label="Text style"
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
          aria-label="Add link"
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
            aria-label="Remove link"
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
          aria-label="Add image"
        >
          <FaImage />
        </button>

        {/* Text Alignment Buttons */}
        <button
          type="button"
          className={`toolbar-button ${isActive('textAlign', { align: 'left' }) ? 'active' : ''}`}
          onClick={() => handleButtonClick('alignLeft')}
          title="Align Left"
          aria-label="Align left"
        >
          <FaAlignLeft />
        </button>

        <button
          type="button"
          className={`toolbar-button ${isActive('textAlign', { align: 'center' }) ? 'active' : ''}`}
          onClick={() => handleButtonClick('alignCenter')}
          title="Align Center"
          aria-label="Align center"
        >
          <FaAlignCenter />
        </button>

        <button
          type="button"
          className={`toolbar-button ${isActive('textAlign', { align: 'right' }) ? 'active' : ''}`}
          onClick={() => handleButtonClick('alignRight')}
          title="Align Right"
          aria-label="Align right"
        >
          <FaAlignRight />
        </button>

        <span className="toolbar-divider" aria-hidden="true" />

        <button
          type="button"
          className={`toolbar-button ${isActive('blockquote') ? 'active' : ''}`}
          onClick={() => handleButtonClick('toggleBlockquote')}
          title="Quote"
          aria-label="Quote"
        >
          <FaQuoteRight />
        </button>

        <button
          type="button"
          className={`toolbar-button ${isActive('codeBlock') ? 'active' : ''}`}
          onClick={() => handleButtonClick('toggleCodeBlock')}
          title="Code block"
          aria-label="Code block"
        >
          <FaCode />
        </button>

        <button
          type="button"
          className="toolbar-button"
          onClick={() => handleButtonClick('setHorizontalRule')}
          title="Divider"
          aria-label="Insert divider"
        >
          <FaMinus />
        </button>

        <button
          type="button"
          className="toolbar-button"
          onClick={() => handleButtonClick('clearFormatting')}
          title="Clear formatting"
          aria-label="Clear formatting"
        >
          <FaEraser />
        </button>

        <span className="toolbar-divider" aria-hidden="true" />

        <button
          type="button"
          className="toolbar-button"
          onClick={() => handleButtonClick('undo')}
          title="Undo"
          aria-label="Undo"
          disabled={!editor.can().chain().focus().undo().run()}
        >
          <FaUndo />
        </button>

        <button
          type="button"
          className="toolbar-button"
          onClick={() => handleButtonClick('redo')}
          title="Redo"
          aria-label="Redo"
          disabled={!editor.can().chain().focus().redo().run()}
        >
          <FaRedo />
        </button>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
      {normalizedMaxLength && (
        <div
          className={`text-editor-character-count${characterCount >= normalizedMaxLength ? ' is-at-limit' : ''}`}
          aria-live="polite"
        >
          {characterCount.toLocaleString()} / {normalizedMaxLength.toLocaleString()}
        </div>
      )}
    </div>
  );
};

export default TextEditor;
