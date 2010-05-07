var Graphy = function(x, y, w, h) {
  var paper = Raphael(x, y, w, h);
  var nodes = [];
  var springs = [];
  var maxIters = 50;
  var minusKinetEnergy = 8.0;
  var ideaIterationIterval = 40; //ms
  
  var any = function(list, iterator) {
    for(var i = 0; i < list.length; i++) {
      if(iterator(list[i])) {
        return true;
      }
    }
    return false;
  }
  
  var detect = function(list, iterator) {
    for(var i = 0; i < list.length; i++) {
      if(iterator(list[i])) {
        return list[i];
      }
    }          
  }
  
  var randomPosNearCenter = function() {
    var x = (w/2.0) - 100.0 + Math.random() * 200.0;
    var y = (h/2.0) - 100.0 + Math.random() * 200.0;
    
    var taken = any(nodes, function(node) {
      return node.overlap(x, y);
    })
    
    if(taken) {
      return randomPosNearCenter();
    } else {
      return [x, y];
    }
  }
  
  var updateNodes = function(passedDuration) {
    if (passedDuration > 20 * ideaIterationIterval) {
      return; // drop a iteration when lag happens
    }
    
    $.map(nodes, function(node) {
      var netForceX = 0;
      var netForceY = 0;
      
      $.map(nodes, function(anotherNode) {
        if(anotherNode === node) { return; }
        netForceX += node.coulombRepulsionXTo(anotherNode);
        netForceY += node.coulombRepulsionYTo(anotherNode);
      })

      $.map(nodes, function(anotherNode) {
        if(anotherNode == node) { return; }
        netForceX += node.hooksForceX();
        netForceY += node.hooksForceY();
      })
      
      node.force(netForceX, netForceY);
    })
    
    $.map(nodes, function(node){
      node.actOnForce(passedDuration);
    })
    
    $.map(springs, function(spring){
      spring.paint();
    })
  }
  
  var totalKineticEnergy = function() {
    var result = 0;
    $.map(nodes, function(node) {
      result += node.kineticEnergy();
    })
    return result;
  }
  
  var drawIteration = function(currentIteration, timeslice) {
    if( currentIteration == 0 ) {
      $.map(nodes, function(node) { node.stop() });
      return;
    }
    
    var now = new Date().getTime();
    
    updateNodes(timeslice)
    
    if ( timeslice != 0 && totalKineticEnergy() < minusKinetEnergy ) {
      drawIteration(0, 0);
      return;
    }
    
    setTimeout(function() {
      drawIteration(currentIteration - 1, new Date().getTime() - now);
    }, ideaIterationIterval);
  }
  
  var findOrCreateNode = function(name) {
    var exist = detect(nodes, function(node) {
      return node.name() == name;
    })
    
    if(exist) { return exist; }
    
    var node = new Graphy.Node(paper, name);
    node.paint(randomPosNearCenter());
    nodes.push(node);
    return node;
  }
  
  return {
    createNode: function(name) {
      findOrCreateNode(name);
    },
    
    add: function(left, link, right) {
      var leftNode = findOrCreateNode(left);
      var rightNode = findOrCreateNode(right);
      var spring = new Graphy.Spring(paper, link, leftNode, rightNode);
      spring.paint(paper);
      springs.push(spring);
    },
    
    draw: function() {
      drawIteration(maxIters, 0);
    }
  }
}


Graphy.Node = function(paper, name) {
  var springs = [];
  var x = 0.0;
  var y = 0.0;
  var r = 20.0;
  var view = null;
  var tooltip = null
  var vx = 0.0;
  var vy = 0.0;
  var fx = 0.0;
  var fy = 0.0;
  var damping = 0.9;
  var chargeConst = 100000;
  var mass = 10;

  
  var showTooltip = function() {
    if(vx!=0 || vy!=0) {
      return;
    }
    tooltip = paper.text(x - 5, y - 35, name);
    tooltip.attr({fill: '#4F575E', font: '20px Verdana'});
    tooltip.attr('textpath', "M" + (x - 20) + " " + (y - 25) + " S" + (x + 20) + " " + (y -25) );
  }
  
  var hideTooltip = function() {
    if(tooltip) {
      tooltip.remove();
    }
  }
  
  var move = function(dx, dy) {
    x = x + dx;
    y = y + dy;
    view.translate(dx, dy);
  }
  
  var distance = function(node) {
    return distanceToPoint(node.x(), node.y());
  }
  
  var distanceToPoint = function(x1, y1) {
    return Math.sqrt((x - x1) * (x - x1) + (y - y1) * (y - y1));
  }
  
  var public = {
    name: function() {return name },
    x: function() { return x; },
    y: function() { return y; },
    
    distance: distance,
    
    force: function(forceX, forceY) {
      fx = forceX;
      fy = forceY;
    },
    
    addSpring: function(s) {
      springs.push(s);
    },
    
    kineticEnergy: function() {
      return mass * Math.sqrt(vx * vx + vy * vy);
    },
    
    coulombRepulsionXTo: function(anotherNode) {
      var dist = distance(anotherNode);
      return chargeConst * (x - anotherNode.x()) / Math.pow(dist, 3)
    },
    
    coulombRepulsionYTo: function(anotherNode) {
      var dist = distance(anotherNode);
      return chargeConst * (y - anotherNode.y()) / Math.pow(dist, 3)
    },
    
    hooksForceX: function() {
      var fx = 0;
      $.map(springs, function(spring) {
        var another = spring.theOtherEndOf(public);
        fx +=  spring.force(distance(another)) * ( x - another.x() ) / distance(another);
      })
      return fx;
    },
    
    hooksForceY: function() {
      var fy = 0;
      $.map(springs, function(spring) {
        var another = spring.theOtherEndOf(public);
        fy +=  spring.force(distance(another)) * ( y - another.y() ) / distance(another);
      })
      return fy;
    },
    
    actOnForce: function(duration) {
      duration = duration / 50.0;
      vx = (vx +  fx / mass * duration) * damping;
      vy = (vy +  fy / mass * duration) * damping;            
      move(duration * vx, duration * vy);
    },
    
    stop: function() {
      vx = 0.0;
      vy = 0.0;
      fx = 0.0;
      fy = 0.0;
    },
    
    posString: function() {
      return x + " " + y;
    },
    
    overlap: function(x1, y1) {
      return distanceToPoint(x1, y1) < 2 * r;
    },
    
    paint: function(pos) {
      if(!view) {
        x = pos[0];
        y = pos[1];
        view = paper.circle(x, y, r);
        view.attr("fill", "#00bdf3");
        view.attr("stroke", "#fff");
        view.node.setAttribute("title", name);
        view.node.onmouseover = showTooltip;
        view.node.onmouseout = hideTooltip;
      }
    }
  }
  return public;
}

Graphy.Spring = function(paper, name, leftNode, rightNode) {
  var view = null;
  var idealLength = 65;
  var forceConst = 0.05;
  
  var public = {
    force: function() {
      var dist = leftNode.distance(rightNode);
      var delta = Math.max(0, dist - idealLength);
      return (-1.0) * forceConst * delta;
    },
    
    paint: function() {
      var pathString = "M" + leftNode.posString() + "L" + rightNode.posString();
      if(view) {
        view.attr("path", pathString);
      } else {
        view = paper.path(pathString).toBack();
        view.node.setAttribute("title", name);              
      }
    },
    
    theOtherEndOf: function(node) {
      if(leftNode === node) { return rightNode; }
      if(rightNode === node) { return leftNode; }
    }
  }
  
  leftNode.addSpring(public);
  rightNode.addSpring(public);
  
  return public;
}