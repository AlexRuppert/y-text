/* global Y */
'use strict'

function extend (Y) {
  Y.requestModules(['Array']).then(function () {
    class YText extends Y.Array['class'] {
      constructor (os, _model, idArray, valArray) {
        super(os, _model, idArray, valArray)
        this.textfields = []
        this.aceInstances = []
      }
      toString () {
        return this.valArray.join('')
      }
      insert (pos, content) {
        super.insert(pos, content.split(''))
      }
      bindAce (ace, options) {
        this.aceInstances.push(ace)
        var self = this

        // this function makes sure that either the
        // quill event is executed, or the yjs observer is executed
        var token = true
        function mutualExcluse (f) {
          if (token) {
            token = false
            try {
              f()
            } catch (e) {
              token = true
              throw new Error(e)
            }
            token = true
          }
        }
        ace.markers = []
        var disableMarkers = false

        if (typeof options === 'object') {
          if (typeof options.disableMarkers !== 'undefined') {
            disableMarkers = options.disableMarkers
          }
        }

        ace.setValue(this.valArray.join(''))

        ace.on('change', function (delta) {
          mutualExcluse(function () {
            var start = 0
            var length = 0

            var aceDocument = ace.getSession().getDocument()
            if (delta.action === 'insert') {
              start = aceDocument.positionToIndex(delta.start, 0)
              self.insert(start, delta.lines.join('\n'))
            } else if (delta.action === 'remove') {
              start = aceDocument.positionToIndex(delta.start, 0)
              length = delta.lines.join('\n').length
              self.delete(start, length)
            }
          })
        })
        if (!disableMarkers) {
          if (this.inteval) {
            clearInterval(this.inteval)
          }
          this.inteval = setInterval(function () {
            var i = 0
            var now = Date.now()
            var timeVisible = 800

            while (i < ace.markers.length) {
              var marker = ace.markers[i]

              if (marker.timestamp + timeVisible < now) {
                ace.getSession().removeMarker(marker.id)
                ace.markers.splice(i, 1)
                i--
              }
              i++
            }
          }, 1000)
        }

        function setMarker (start, end, klazz) {
          if (disableMarkers) {
            return
          }
          var offset = 0
          if (start.row === end.row && start.column === end.column) {
            offset = 1
          }
          var range = new ace.Range(start.row, start.column, end.row, end.column + offset)
          var marker = ace.session.addMarker(range, klazz, 'text')
          ace.markers.push({id: marker, timestamp: Date.now()})
        }

        this.observe(function (events) {
          var aceDocument = ace.getSession().getDocument()
          var start = 0
          var end = 0
          mutualExcluse(function () {
            for (var i = 0; i < events.length; i++) {
              var event = events[i]
              if (event.type === 'insert') {
                start = aceDocument.indexToPosition(event.index, 0)
                end = aceDocument.indexToPosition(event.index + event.value.length, 0)
                aceDocument.insert(start, event.value)

                setMarker(start, end, 'inserted')
              } else if (event.type === 'delete') {
                start = aceDocument.indexToPosition(event.index, 0)
                end = aceDocument.indexToPosition(event.index + event.length, 0)
                var range = new ace.Range(start.row, start.column, end.row, end.column)
                aceDocument.remove(range)

                setMarker(start, end, 'deleted')
              }
            }
          })
        })
      }
      bind () {
        if (typeof arguments[0] === 'object') {
          this.bindAce.apply(this, arguments)
        } else {
          this.bindTextarea.apply(this, arguments)
        }
      }
      bindTextarea (textfield, domRoot) {
        domRoot = domRoot || window; // eslint-disable-line
        if (domRoot.getSelection == null) {
          domRoot = window; // eslint-disable-line
        }

        // don't duplicate!
        for (var t in this.textfields) {
          if (this.textfields[t] === textfield) {
            return
          }
        }
        var creatorToken = false

        var word = this
        textfield.value = this.toString()
        this.textfields.push(textfield)
        var createRange, writeRange, writeContent
        if (textfield.selectionStart != null && textfield.setSelectionRange != null) {
          createRange = function (fix) {
            var left = textfield.selectionStart
            var right = textfield.selectionEnd
            if (fix != null) {
              left = fix(left)
              right = fix(right)
            }
            return {
              left: left,
              right: right
            }
          }
          writeRange = function (range) {
            writeContent(word.toString())
            textfield.setSelectionRange(range.left, range.right)
          }
          writeContent = function (content) {
            textfield.value = content
          }
        } else {
          createRange = function (fix) {
            var range = {}
            var s = domRoot.getSelection()
            var clength = textfield.textContent.length
            range.left = Math.min(s.anchorOffset, clength)
            range.right = Math.min(s.focusOffset, clength)
            if (fix != null) {
              range.left = fix(range.left)
              range.right = fix(range.right)
            }
            var editedElement = s.focusNode
            if (editedElement === textfield || editedElement === textfield.childNodes[0]) {
              range.isReal = true
            } else {
              range.isReal = false
            }
            return range
          }

          writeRange = function (range) {
            writeContent(word.toString())
            var textnode = textfield.childNodes[0]
            if (range.isReal && textnode != null) {
              if (range.left < 0) {
                range.left = 0
              }
              range.right = Math.max(range.left, range.right)
              if (range.right > textnode.length) {
                range.right = textnode.length
              }
              range.left = Math.min(range.left, range.right)
              var r = document.createRange(); // eslint-disable-line
              r.setStart(textnode, range.left)
              r.setEnd(textnode, range.right)
              var s = window.getSelection(); // eslint-disable-line
              s.removeAllRanges()
              s.addRange(r)
            }
          }
          writeContent = function (content) {
            var contentArray = content.replace(new RegExp('\n', 'g'), ' ').split(' '); // eslint-disable-line
            textfield.innerText = ''
            for (var i in contentArray) {
              var c = contentArray[i]
              textfield.innerText += c
              if (i !== contentArray.length - 1) {
                textfield.innerHTML += '&nbsp;'
              }
            }
          }
        }
        writeContent(this.toString())

        this.observe(function (events) {
          for (var e in events) {
            var event = events[e]
            if (!creatorToken) {
              var oPos, fix
              if (event.type === 'insert') {
                oPos = event.index
                fix = function (cursor) { // eslint-disable-line
                  if (cursor <= oPos) {
                    return cursor
                  } else {
                    cursor += 1
                    return cursor
                  }
                }
                var r = createRange(fix)
                writeRange(r)
              } else if (event.type === 'delete') {
                oPos = event.index
                fix = function (cursor) { // eslint-disable-line
                  if (cursor < oPos) {
                    return cursor
                  } else {
                    cursor -= 1
                    return cursor
                  }
                }
                r = createRange(fix)
                writeRange(r)
              }
            }
          }
        })
        // consume all text-insert changes.
        textfield.onkeypress = function (event) {
          if (word.is_deleted) {
            // if word is deleted, do not do anything ever again
            textfield.onkeypress = null
            return true
          }
          creatorToken = true
          var char
          if (event.keyCode === 13) {
            char = '\n'
          } else if (event.key != null) {
            if (event.charCode === 32) {
              char = ' '
            } else {
              char = event.key
            }
          } else {
            char = window.String.fromCharCode(event.keyCode); // eslint-disable-line
          }
          if (char.length > 1) {
            return true
          } else if (char.length > 0) {
            var r = createRange()
            var pos = Math.min(r.left, r.right, word.length)
            var diff = Math.abs(r.right - r.left)
            word.delete(pos, diff)
            word.insert(pos, char)
            r.left = pos + char.length
            r.right = r.left
            writeRange(r)
          }
          event.preventDefault()
          creatorToken = false
          return false
        }
        textfield.onpaste = function (event) {
          if (word.is_deleted) {
            // if word is deleted, do not do anything ever again
            textfield.onpaste = null
            return true
          }
          event.preventDefault()
        }
        textfield.oncut = function (event) {
          if (word.is_deleted) {
            // if word is deleted, do not do anything ever again
            textfield.oncut = null
            return true
          }
          event.preventDefault()
        }
        //
        // consume deletes. Note that
        //   chrome: won't consume deletions on keypress event.
        //   keyCode is deprecated. BUT: I don't see another way.
        //     since event.key is not implemented in the current version of chrome.
        //     Every browser supports keyCode. Let's stick with it for now..
        //
        textfield.onkeydown = function (event) {
          creatorToken = true
          if (word.is_deleted) {
            // if word is deleted, do not do anything ever again
            textfield.onkeydown = null
            return true
          }
          var r = createRange()
          var pos = Math.min(r.left, r.right, word.toString().length)
          var diff = Math.abs(r.left - r.right)
          if (event.keyCode != null && event.keyCode === 8) { // Backspace
            if (diff > 0) {
              word.delete(pos, diff)
              r.left = pos
              r.right = pos
              writeRange(r)
            } else {
              if (event.ctrlKey != null && event.ctrlKey) {
                var val = word.toString()
                var newPos = pos
                var delLength = 0
                if (pos > 0) {
                  newPos--
                  delLength++
                }
                while (newPos > 0 && val[newPos] !== ' ' && val[newPos] !== '\n') {
                  newPos--
                  delLength++
                }
                word.delete(newPos, pos - newPos)
                r.left = newPos
                r.right = newPos
                writeRange(r)
              } else {
                if (pos > 0) {
                  word.delete(pos - 1, 1)
                  r.left = pos - 1
                  r.right = pos - 1
                  writeRange(r)
                }
              }
            }
            event.preventDefault()
            creatorToken = false
            return false
          } else if (event.keyCode != null && event.keyCode === 46) { // Delete
            if (diff > 0) {
              word.delete(pos, diff)
              r.left = pos
              r.right = pos
              writeRange(r)
            } else {
              word.delete(pos, 1)
              r.left = pos
              r.right = pos
              writeRange(r)
            }
            event.preventDefault()
            creatorToken = false
            return false
          } else {
            creatorToken = false
            return true
          }
        }
      }
    }
    Y.extend('Text', new Y.utils.CustomType({
      name: 'Text',
      class: YText,
      struct: 'List',
      initType: function * YTextInitializer (os, model) {
        var valArray = []
        var idArray = yield* Y.Struct.List.map.call(this, model, function (c) {
          valArray.push(c.content)
          return JSON.stringify(c.id)
        })
        return new YText(os, model.id, idArray, valArray)
      }
    }))
  })
}

module.exports = extend
if (typeof Y !== 'undefined') {
  extend(Y)
}
