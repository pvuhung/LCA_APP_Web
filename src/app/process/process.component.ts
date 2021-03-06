import { Component, HostListener, ViewChild, ElementRef, AfterViewInit, OnInit, ChangeDetectorRef, Inject, Input } from '@angular/core';
import { Rect } from './Rect';
import { Connector } from './Connector';
import * as SVG from 'svg.js';
import 'svg.draggy.js';
import '../../../svg.connectable.js/src/svg.connectable.js';
import { DataService } from "../data.service";
import { Router } from '@angular/router';
import { Project } from '../project';
import { FormArray, FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute } from "@angular/router";
import * as html2canvas from 'html2canvas';

import { MaterialInput } from './MaterialInput';
import { Line } from './Line';
import { Output } from './Output';
import { Byproduct } from './Byproduct';
import { EnergyInput } from './EnergyInput';
import { TransportationInput } from './TransportationInput';
import { DirectEmission } from './DirectEmission';
import { CookieService } from 'ngx-cookie-service';
import { MatDialog, MAT_DIALOG_DATA, MatDialogConfig } from '@angular/material'


@Component({
    selector: 'app-dialog',
    templateUrl: '../dialog/dialog.component.html'
})

export class Dialog {
    text: String;
    constructor(@Inject(MAT_DIALOG_DATA) public data: any) {
    this.text = data.text}
    
}

@Component({
    selector: 'app-confirmationDialog',
    templateUrl: '../dialog/confirmationDialog.html'
})

export class confirmationDialog {
    text: String;
    action: String;
    constructor(@Inject(MAT_DIALOG_DATA) public data: any) {
        this.text = data.text;
        this.action = data.action;
    }

}

@Component({
    selector: 'app-process',
    templateUrl: './process.component.html',
    styleUrls: ['./process.component.css']
})
export class ProcessComponent implements AfterViewInit, OnInit {
    @ViewChild('containerHeader') containerHeader: ElementRef;
    @ViewChild('processcontainer') processcontainer: ElementRef;
    @ViewChild('svg') svg: ElementRef;
    @ViewChild('svgabandoned') svgabandoned: ElementRef;
    @ViewChild('name') processName: ElementRef;
    @ViewChild('sidenav') sidenav: ElementRef;

    private mouseX;
    private mouseY;
    private head = null;
    private tail = null;
    private draw;
    private abandonedDraw;
    private headerWidth;
    private headerHeight;
    private processContainerHeight;
    private svgOffsetLeft;
    private svgOffsetTop;
    private lifeCycleStages;
    // stores Rect object of the unallocated node and the index of the unallocated node in processNodes
    private abandonedNodes: any[] = [];
    private isAbandonedNodesSelected: Boolean = false;
    private transferedRect: SVG.Rect = null;
    private currentlySelectedNode;
    currentlySelectedNodeName;
    private currentlySelectedText: SVG.Text = null;
    private processContainerWidth;
    private arrayOfSeparators: Line[] = [];
    // [the current width that changed, index of the lifecycle stage]
    // [the current width - 1 that changed, index of the lifecycle stage]
    private currentOnResizeWidthArray: number[][] = [[]];
    private previousDimensionArray: number[] = [];
    private isEdit: Boolean = false;

    //current container Width
    private currentContainerWidth;
    private size = 100;

    private waitId;

    //list of promptRect generated
    //stores an array [rectobj, index of the rectobj]
    private idPrompt: any[] = [];
    private svgPrompt: any[] = [];
    private svgPromptConn: any[] = [];
    private svgText: any[] = [];

    private prevSVG: any[] = [];
    private svgNode: any[] = [];

    private isDisplayPrompt: Boolean = false;
    currentProcessName = '';
    materialForm: FormGroup; energyForm: FormGroup; transportForm: FormGroup; outputForm: FormGroup; byproductForm: FormGroup; emissionForm: FormGroup;
    materialList: FormArray; energyList: FormArray; transportList: FormArray; outputList: FormArray; byproductList: FormArray; emissionList: FormArray;
    
    processIdMap = {};                                                  /*Map a process' id to its index in the file*/
    inputMenuBar = ['Material', 'Energy', 'Transport'];                 //Names of the input tabs
    outputMenuBar = [' Material ', 'Byproduct', 'Emission'];            //Names of the output tabs
    selectedTab = this.inputMenuBar[0];                                 //Name of the currently selected tab

    navFromResult = {};                                                 //Object storing the process and the tab double clicked from result component
    previousSelect = "";                                                //Save the value of the previous selected option, in order to update connecting arrows
    materialOptions: string[] = [];                                     //Array of all material name to suggest
    filteredOptions: string[] = [];                                     //Filtered material name suggestions to display
    emissionOptions: string[] = [];                                     //Array of all emission type to suggest
    filteredEmissions: string[] = [];                                   //Filtered emission type suggestions to display
    isHoverOverOptions: false;                                          //Boolean to check if a suggested option was chosen by clicking or keyboard Enter

    isOpen = false;

    //currently selected Node

    project: Project = this.dataService.getProject();                   //Object to contain all data of the current project
    lastSaved = '';        


    //================================================================
    //                    STARTING FUNCTIONS
    //================================================================
    constructor(private dataService: DataService, private router: Router,
                private cd: ChangeDetectorRef, private cookies: CookieService,
                public dialog: MatDialog, private fb: FormBuilder,
                private route: ActivatedRoute) {
        this.route.params.subscribe(params => {
            this.navFromResult = params;
        });
    }
    
    ngOnInit() {
        this.project = this.dataService.getProject();
        this.materialForm   = this.fb.group({ inputs: this.fb.array([]) });
        this.energyForm     = this.fb.group({ inputs: this.fb.array([]) });
        this.transportForm  = this.fb.group({ inputs: this.fb.array([]) });
        this.outputForm     = this.fb.group({ inputs: this.fb.array([]) });
        this.byproductForm  = this.fb.group({ inputs: this.fb.array([]) });
        this.emissionForm   = this.fb.group({ inputs: this.fb.array([]) });

        this.materialList   = this.materialForm.get('inputs') as FormArray;
        this.energyList = this.energyForm.get('inputs') as FormArray;
        this.transportList = this.transportForm.get('inputs') as FormArray;
        this.outputList = this.outputForm.get('inputs') as FormArray;
        this.byproductList = this.byproductForm.get('inputs') as FormArray;
        this.emissionList = this.emissionForm.get('inputs') as FormArray;
      
        let pc = document.getElementById('processcontainer');
        pc.oncontextmenu = function () {
            return false;
        }

        //Initialize the rectId-to-process-name map
        for (let i = 0; i < this.project.processNodes.length; i++) {
            var node = this.project.processNodes[i];
            this.processIdMap[node.id] = {
                name: node.processName,
                index: i
            };
        }
        this.updateRelations();
        this.updateMaterialOptions();
    }

    ngAfterViewInit() {
        this.draw = SVG('svg');
        this.abandonedDraw = SVG('svgabandoned').style({background: "transparent"});
        this.generatingComponents();
        this.generatingProcessNodes();
        this.generatingAbandonedNodes();

        this.route.url.subscribe(value => {
            if (value.length >= 2 && value[1].path == "export") {
                this.exportPDF();
                this.router.navigate(['result']);
            }
        });
    }

    /**
     * Generating lifecycle stages
     * */
    generatingComponents() {
        this.svgOffsetLeft = this.svg.nativeElement.offsetLeft;
        this.svgOffsetTop = this.svg.nativeElement.offsetTop;
        this.headerWidth = this.containerHeader.nativeElement.offsetWidth;
        this.headerHeight = this.containerHeader.nativeElement.offsetHeight;
        this.processContainerHeight = this.processcontainer.nativeElement.offsetHeight;
        this.processContainerWidth = this.processcontainer.nativeElement.offsetWidth;
        this.draw.size(this.processContainerWidth, this.processContainerHeight);
        //getting previous dimension 
        this.previousDimensionArray = Object.assign([], this.project.dimensionArray);
        this.project.processDimension = this.processContainerWidth;

        let previousDimnesion = 0;
        for (let i = 0; i < this.project.dimensionArray.length; i++) {
            previousDimnesion += this.project.dimensionArray[i];
        }
        for (let i = 0; i < this.project.dimensionArray.length; i++) {
            if (this.project.dimensionArray[i] != null) {
                if (this.currentContainerWidth != null && this.currentContainerWidth != this.processContainerWidth) {

                    this.project.dimensionArray[i] = this.project.dimensionArray[i] * this.processContainerWidth / this.currentContainerWidth;
                } else if (this.processContainerWidth != previousDimnesion) {
                    let scalingFactor = this.processContainerWidth / previousDimnesion;
                    this.project.dimensionArray[i] = this.project.dimensionArray[i] * scalingFactor;
                }
            } else {
                this.project.dimensionArray[i] = this.headerWidth;
            }
        }
        this.lifeCycleStages = this.project.lifeCycleStages;
        for (let i = 0; i < this.project.lifeCycleStages.length; i++) {
            let width = this.project.dimensionArray[i];
            if (width != null) {
                document.getElementById("lifestage" + i).style.width = width + "px";
            } else {
                document.getElementById("lifestage" + i).style.width = this.headerWidth + "px";
            }
        }
        let accumWidth = 0;
        for (let i = 1; i < this.lifeCycleStages.length; i++) {
            let line;
            if (this.project.separatorArray.length == 0 || this.project.separatorArray[i - 1] == undefined) {
                let startX = this.project.dimensionArray[i - 1] * i + 3 * (i - 1);
                let endX = startX;
                let endY = this.processContainerHeight - this.headerHeight - 10;
                line = this.draw.line(startX, 5, endX, endY);
                line.stroke({ color: '#000', width: 2, linecap: 'square' })
                line.data('key', {
                    posX: line.x(),
                    index: i,
                });
                line.draggy();
                this.arrayOfSeparators.push(new Line(startX, endY, line.node.id));
            } else {
                this.arrayOfSeparators = this.project.separatorArray;
                let lineObj = this.project.separatorArray[i - 1];
                accumWidth += this.project.dimensionArray[i - 1]
                line = this.draw.line(accumWidth, 5, accumWidth, lineObj.endY);
                //update id of the object
                this.project.separatorArray[i - 1].id = line.node.id;
                line.stroke({ color: '#000', width: 1, linecap: 'square' })
                line.data('key', {
                    posX: line.x(),
                    index: i,
                });
                line.draggy();
            }
            line.on('mouseover', (event) => {
                document.body.style.cursor = "e-resize";
            });
            line.on('mouseout', (event) => {
                document.body.style.cursor = "default";
            });

            line.on('dragmove', (event) => {
                //calculating the difference in the original position and the final position to get the change in position
                let distanceMoved = line.data('key').posX - line.x();
                let prevAccumulatedWidth = 0;
                for (let i = 0; i < this.project.lifeCycleStages.length; i++) {

                    if (i == line.data('key').index) { //next section
                        //expand or contract the container
                        line.move(this.mouseX - this.svgOffsetLeft, 10);
                        if (this.project.dimensionArray[i] != null) {
                            let newWidth = this.project.dimensionArray[i] + distanceMoved;
                            document.getElementById("lifestage" + i).style.width = newWidth + "px";
                            this.currentOnResizeWidthArray[0] = [newWidth, i];
                        } else {
                            document.getElementById("lifestage" + i).style.width = this.headerWidth + distanceMoved + "px";
                            this.currentOnResizeWidthArray[0] = [this.headerWidth + distanceMoved, i];
                        }

                        //take note huge time overhead
                        for (let j = 0; j < this.project.processNodes.length; j++) {
                            let rectObj = this.project.processNodes[j];
                            if (rectObj.categories == this.lifeCycleStages[i]) {
                                let rectElement = SVG.get(rectObj.id);
                                if (rectElement.x() - line.x() < 10) {
                                    rectElement.move(rectElement.x() + 5, rectElement.y());
                                }
                            }
                        }
                    } else if (i + 1 == line.data('key').index) { // if it is the previous section
                        //expand or contract
                        if (this.project.dimensionArray[i] != null) {
                            let newWidth = this.project.dimensionArray[i] - distanceMoved;
                            document.getElementById("lifestage" + i).style.width = newWidth + "px";
                            this.currentOnResizeWidthArray[1] = [newWidth, i];
                        } else {
                            document.getElementById("lifestage" + i).style.width = this.headerWidth - distanceMoved + "px";
                            this.currentOnResizeWidthArray[1] = [this.headerWidth - distanceMoved, i];
                        }
                        for (let j = 0; j < this.project.processNodes.length; j++) {
                            let rectObj = this.project.processNodes[j];
                            if (rectObj.categories == this.lifeCycleStages[i]) {
                                let rectElement = SVG.get(rectObj.id);
                                if (line.x() - rectElement.x() < 110) {
                                    rectElement.move(rectElement.x() - 5, rectElement.y());
                                }
                            }
                        }
                    } else {
                        //stay put

                        let dataWidth = this.project.dimensionArray[i];
                        if (dataWidth != null) {
                            document.getElementById("lifestage" + i).style.width = dataWidth + "px";
                        } else {
                            document.getElementById("lifestage" + i).style.width = this.headerWidth + "px";
                        }
                    }


                }
            });

            line.on('dragend', (event) => {
                for (let i = 0; i < this.currentOnResizeWidthArray.length; i++) {
                    //updating dimensionArray 
                    this.project.dimensionArray[this.currentOnResizeWidthArray[i][1]] = this.currentOnResizeWidthArray[i][0];
                    line.data('key', {
                        posX: line.x(),
                        index: line.data('key').index
                    });
                    //updating separatorArray
                    if (this.currentOnResizeWidthArray[i][1] != this.project.separatorArray.length) {
                        let lineObj = this.project.separatorArray[this.currentOnResizeWidthArray[i][1]];
                        let svgLine = SVG.get(lineObj.id);
                        this.project.separatorArray[this.currentOnResizeWidthArray[i][1]].startX = svgLine.x();
                    }
                }
            });
        }
        this.project.separatorArray = this.arrayOfSeparators;
        this.currentContainerWidth = this.processContainerWidth;
    }

    /**
     * gerating nodes by going through data
     * */
    generatingProcessNodes() {
        //generating process nodes that was saved
        for (let j = 0; j < this.project.processNodes.length; j++) {
            var node = this.project.processNodes[j];
            let accumWidth = 0;
            let allocated = false;
            for (let k = 0; k < this.project.lifeCycleStages.length; k++) {
                if (node.getCategories() == this.project.lifeCycleStages[k]) {
                    this.createProcessNodes(j, accumWidth, false);
                    allocated = true;
                }
                //if could not find a categories, means that the category have been deleted
                if (k == this.project.lifeCycleStages.length - 1 && !allocated) {
                    this.abandonedNodes.push([node, j]); // [Rect object of unallocated node, index of unallocated node in process nodes]
                } else {
                    accumWidth += this.project.dimensionArray[k];

                }

            }
        }

        //generating process links that was saved
        for (let i = 0; i < this.project.processNodes.length; i++) {
            var current = this.project.processNodes[i];
            //check if the node is decategorised
            //true: skip the node
            //false: go on to check if the nextID is decategorised
            if (!this.checkIfNodeIsDecategorised(current.getId())) {
                for (let j = 0; j < this.project.processNodes[i].getNext().length; j++) {
                    var next = this.project.processNodes[i].getNext()[j]
                    //check if the nextID is decategorised
                    //true: remove the node from the array
                    //false: connect the two nodes together
                    if (!this.checkIfNodeIsDecategorised(next)) {
                        var head = SVG.get(this.project.processNodes[i].getId());
                        var tail = SVG.get(next);
                        this.creatingProcessLinks(head, tail, this.project.processNodes[i].getConnectors()[j]);
                    } else {
                        this.project.processNodes[i].getNext().splice(j, 1);
                        this.project.processNodes[i].getConnectors().splice(j, 1);
                    }
                }
            }
        }
    }

    generatingAbandonedNodes() {
        for (let i = 0; i < this.abandonedNodes.length; i++) {
            let node = this.abandonedNodes[i][0];
            let indexAtProcesses = this.abandonedNodes[i][1];
            node.clearNextArrayConnect();
            this.createAbandonedNodes(node, i, indexAtProcesses);
        }
    }

    //================================================================
    //                    CHECKING FUNCTIONS
    //================================================================
    /**
     * Check if this.project.processNodes is empty, 
     * for the purpose of disallowing users from proceeding
     */
    hasNoProcess() {
        var hasProcess: boolean = false;
        for (var i = 0; i < this.project.processNodes.length; i++) {
            hasProcess = hasProcess || this.project.lifeCycleStages.includes(this.project.processNodes[i].categories);
        }
        return !hasProcess;
    }

    /**
     * Check if this component was nagivated back from result's matrix
     */
    isNavFromResult() {
        if (this.navFromResult.hasOwnProperty('processId'))
            return true;
        return false;
    }

    /**
     * Checking if a node is decategorise
     * @param id id of the node from processNodes array while looping through the data
     */
    checkIfNodeIsDecategorised(id) {
        for (let i = 0; i < this.abandonedNodes.length; i++) {
            if (this.abandonedNodes[i][0].getId() == id) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check whether a link has already be established 
     * @returns boolean 
     * */
    checkIfLinkExist() {
        let headObj = this.project.processNodes[this.head.data('key')];
        let tailObj = this.project.processNodes[this.tail.data('key')];
        for (let i = 0; i < headObj.nextId.length; i++) {
            if (headObj.nextId[i] == tailObj.id) {
                this.showLinkExistWarning();
                return true;
            }
        }
        return false;
    }

    /**
     * Check if all inputs in the current tab are collapsed
     * @param tab
     */
    areAllCollapsed(tab) {
        switch (tab) {
            case this.inputMenuBar[0]:   //Material Input
                for (var i = 0; i < this.materialList.length; i++) {
                    if (!this.materialList.at(i).value.isCollapsed)
                        return false;
                }
                return true;
            case this.inputMenuBar[1]:   //Energy Input
                for (var i = 0; i < this.energyList.length; i++) {
                    if (!this.energyList.at(i).value.isCollapsed)
                        return false;
                }
                return true;
            case this.inputMenuBar[2]:   //Transportation Input
                for (var i = 0; i < this.transportList.length; i++) {
                    if (!this.transportList.at(i).value.isCollapsed)
                        return false;
                }
                return true;
            case this.outputMenuBar[0]:   //Output
                for (var i = 0; i < this.outputList.length; i++) {
                    if (!this.outputList.at(i).value.isCollapsed)
                        return false;
                }
                return true;
            case this.outputMenuBar[1]:   //Byproduct
                for (var i = 0; i < this.byproductList.length; i++) {
                    if (!this.byproductList.at(i).value.isCollapsed)
                        return false;
                }
                return true;
            case this.outputMenuBar[2]:   //Direct Emission
                for (var i = 0; i < this.emissionList.length; i++) {
                    if (!this.emissionList.at(i).value.isCollapsed)
                        return false;
                }
                return true;
        }
    }

    //================================================================
    //                  DETAILS-RELATED FUNCTIONS
    //================================================================
    /**
     * Get the corresponding Rect obj from the processNodes array, given a SVG.Rect object
     * @param rect the SVG.Rect object to compare with
     */
    getCorrespondingRect(rect: SVG.Rect) {
        for (let i = 0; i < this.project.processNodes.length; i++) {
            let rectObj = this.project.processNodes[i];
            if (rectObj.getId() == rect.node.id) {
                return { rectObj, i };
            }
        }
    }

    /**
     * Get the details of the process node and display it in the input form
     * @param array keydata of a connector [index of rect, index of connector]
     */
    getDetails() {
        //get corresponding rect 
        if (this.currentlySelectedNode == undefined || this.currentlySelectedNode == null) {
            return;
        }
        let rectObj = this.project.processNodes[this.currentlySelectedNode.data('key')];
        this.currentlySelectedNode.processName = rectObj.processName;
        this.processIdMap[rectObj.id] = {
            name: rectObj.processName,
            index: this.currentlySelectedNode.data('key')
        };
        switch (this.selectedTab) {
            case this.inputMenuBar[0]:           //Material Input
                //Clear old data
                this.clearFormArray(this.materialList);
                //Add data to the list
                for (let j = 0; j < rectObj.materialInput.length; j++) {
                    var formGroup = this.fb.group(this.transformForFormBuilder(rectObj.materialInput[j]));
                    formGroup.controls.materialName.valueChanges.subscribe(value => { this.getSuggestions(value); });
                    this.materialList.push(formGroup);
                }
                break;
            case this.inputMenuBar[1]:       //Energy Input
                //Clear old data
                this.clearFormArray(this.energyList);
                //Add data to the list
                for (let j = 0; j < rectObj.energyInputs.length; j++) {
                    this.energyList.push(this.fb.group(rectObj.energyInputs[j]));
                }
                break;
            case this.inputMenuBar[2]:       //Transportation Input
                //Clear old data
                this.clearFormArray(this.transportList);
                //Add data to the list
                for (let j = 0; j < rectObj.transportations.length; j++) {
                    this.transportList.push(this.fb.group(rectObj.transportations[j]));
                }
                break;
            case this.outputMenuBar[0]:       //Output
                //Clear old data
                this.clearFormArray(this.outputList);
                //Add data to the list
                for (let j = 0; j < rectObj.outputs.length; j++) {
                    var formGroup = this.fb.group(this.transformForFormBuilder(rectObj.outputs[j]));
                    formGroup.controls.outputName.valueChanges.subscribe(value => { this.getSuggestions(value); });
                    this.outputList.push(formGroup);
                }
                break;
            case this.outputMenuBar[1]:       //Byproduct
                //Clear old data
                this.clearFormArray(this.byproductList);
                //Add data to the list
                for (let j = 0; j < rectObj.byproducts.length; j++) {
                    this.byproductList.push(this.fb.group(rectObj.byproducts[j]));
                }
                break;
            case this.outputMenuBar[2]:       //Direct Emission
                //Clear old data
                this.clearFormArray(this.emissionList);
                //Add data to the list
                for (let j = 0; j < rectObj.directEmissions.length; j++) {
                    var formGroup = this.fb.group(rectObj.directEmissions[j]);
                    formGroup.controls.emissionType.valueChanges.subscribe(value => { this.getSuggestions(value); });
                    this.emissionList.push(formGroup);
                }
                break;
        }
        this.cd.detectChanges();                    //Detect change and update the DOM
        this.updateMaterialOptions();
        this.getSuggestions("");
    }

    /**
     * Save the data from the currently selected node into the project, then clear the input form
     */
    saveAndClearDetails() {
        if (this.currentlySelectedNode == undefined || this.currentlySelectedNode == null) {
            return;
        }
        //get corresponding node 
        let rectObj = this.project.processNodes[this.currentlySelectedNode.data('key')]
        this.prepareForUndoableAction();
        //Update all material inputs
        switch (this.selectedTab) {
            case this.inputMenuBar[0]:       //Material Input
                //Create new data array
                var materialInputs: MaterialInput[] = [];
                for (let j = 0; j < this.materialList.length; j++) {
                    //Push data to the array if it's not empty
                    var materialInput = new MaterialInput();
                    materialInput.parseData(this.materialList.at(j).value);
                    if (!materialInput.equals(new MaterialInput())) {
                        materialInputs.push(materialInput);
                    }
                }
                //Update the array for the rect
                rectObj.materialInput = materialInputs;
                break;
            case this.inputMenuBar[1]:       //Energy Input
                //Create new data array
                var energyInputs: EnergyInput[] = [];
                for (let j = 0; j < this.energyList.length; j++) {
                    //Push data to the array if it's not empty
                    var energyInput = new EnergyInput();
                    energyInput.parseData(this.energyList.at(j).value);
                    if (!energyInput.equals(new EnergyInput()))
                        energyInputs.push(energyInput);
                }
                //Update the array for the rect
                rectObj.energyInputs = energyInputs;
                break;
            case this.inputMenuBar[2]:       //Transportation Input
                //Create new data array
                var transportationInputs: TransportationInput[] = [];
                for (let j = 0; j < this.transportList.length; j++) {
                    //Push data to the array if it's not empty
                    var transport = new TransportationInput();
                    transport.parseData(this.transportList.at(j).value);
                    if (!transport.equals(new TransportationInput()))
                        transportationInputs.push(transport);
                }
                //Update the array for the rect
                rectObj.transportations = transportationInputs;
                break;
            case this.outputMenuBar[0]:       //Output
                //Create new data array
                var outputs: Output[] = [];
                for (let j = 0; j < this.outputList.length; j++) {
                    //Push data to the array if it's not empty
                    var output = new Output();
                    output.parseData(this.outputList.at(j).value);
                    if (!output.equals(new Output()))
                        outputs.push(output);
                }
                //Update the array for the rect
                rectObj.outputs = outputs;
                break;
            case this.outputMenuBar[1]:       //Byproduct
                //Create new data array
                var byproducts: Byproduct[] = [];
                for (let j = 0; j < this.byproductList.length; j++) {
                    //Push data to the array if it's not empty
                    var byproduct = new Byproduct();
                    byproduct.parseData(this.byproductList.at(j).value);
                    if (!byproduct.equals(new Byproduct()))
                        byproducts.push(byproduct);
                }
                //Update the array for the rect
                rectObj.byproducts = byproducts;
                break;
            case this.outputMenuBar[2]:       //Direct Emission
                //Create new data array
                var emissions: DirectEmission[] = [];
                for (let j = 0; j < this.emissionList.length; j++) {
                    //Push data to the array if it's not empty
                    var emission = new DirectEmission();
                    emission.parseData(this.emissionList.at(j).value);
                    if (!emission.equals(new DirectEmission()))
                        emissions.push(emission);
                }
                //Update the array for the rect
                rectObj.directEmissions = emissions;
                break;
        }
        //Save the process name and data to the app
        rectObj.processName = this.currentlySelectedNode.processName;
        this.processIdMap[rectObj.id] = {
            name: rectObj.processName,
            index: this.currentlySelectedNode.data('key')
        };
        this.currentlySelectedText.text(rectObj.processName);
        this.project.processNodes[this.currentlySelectedNode.data('key')] = rectObj;
        if (this.isDisplayPrompt) {
            this.creatingPromptRect(rectObj, this.currentlySelectedNode.data('key'), false);
        }
        //check for input and output
    }
    
    /**
     * Update the array of material name and emissions for autocomplete
     */
    updateMaterialOptions() {
        this.materialOptions = [];
        for (let proc of this.project.processNodes) {
            for (let input of proc.materialInput) {
                var material = input.materialName.toLowerCase();
                if (!this.materialOptions.includes(material) && material != "") {
                    this.materialOptions.push(material);
                }
            }
            for (let output of proc.outputs) {
                var material = output.outputName.toLowerCase();
                if (!this.materialOptions.includes(material) && material != "") {
                    this.materialOptions.push(material);
                }
            }
        }
        this.emissionOptions = [];
        for (let proc of this.project.processNodes) {
            for (let emission of proc.directEmissions) {
                var type = emission.emissionType.toLowerCase();
                if (!this.emissionOptions.includes(type) && type != "") {
                    this.emissionOptions.push(type);
                }
            }
        }
        //console.log('New material options:', this.materialOptions);
    }

    /**
     * Function called when a material name is updated in MaterialInput or in Output
     * */
    materialNameChange() {
        if (!this.isHoverOverOptions) {
            this.saveAndClearDetails();
            this.updateRelations();
            this.getDetails();
        }
        this.updateMaterialOptions()
    }

    /**
     * Get suggestions based on the string given
     * @param str the string given
     */
    getSuggestions(str) {
        this.filteredOptions = this.materialOptions.filter(option => option.toLowerCase().includes(str.toLowerCase()));
        this.filteredEmissions = this.emissionOptions.filter(option => option.toLowerCase().includes(str.toLowerCase()));
    }

    creatingPromptRect(rectObj: Rect, index, isToggle:boolean) {
        let materialInputArr = rectObj.materialInput;
        let outputArr = rectObj.outputs;
        for (let i = 0; i < materialInputArr.length; i++) {
            let input = materialInputArr[i];
            let name = input.materialName;
            if (!this.isAttributeExistInNode(name, 'input', rectObj)) {
                //create a prompt rect
                let x = rectObj.x;
                let y = rectObj.y;
                
                let promptRectOutput = [];
                let promptRectNextid = [];
                let outputObj = new Output();
                outputObj.outputName = name;
                outputObj.quantity = input.quantity;
                promptRectOutput.push(outputObj)
                promptRectNextid.push(rectObj.id);
                //console.log(x, y);


                let xPrompt, yPrompt;
                if (x > this.processContainerWidth) {
                    xPrompt = x;
                } else {
                    xPrompt = x - 120
                }
                console.log(y, this.svgOffsetTop);
                yPrompt = y - 100 + 80 * (i);
                if (yPrompt < 10) {
                    yPrompt = 15;
                }
                let r = new Rect(xPrompt, yPrompt, rectObj.id + i + 'input', promptRectNextid, [], rectObj.categories, name, [], promptRectOutput, [], [], [], [])
                //console.log(r.id);
                if (this.isPromptRectCreated(r.id)) {
                    continue;
                }

                //draw process node
                let rect = this.draw.rect(100, 50);
                let text = this.draw.text('Click to add "prodction of ' +  name + ' "');

                rect.node.id = r.id;
                rect.attr({
                    x: r.getX(),
                    y: r.getY(),
                    class: Rect,
                    fill: '#FFF',
                    'stroke-width': 1,
                    'stroke-dasharray': 5
                });

                text.attr({
                    id: rect.node.id + "text"
                });

                text.move(rect.x(), rect.y() - 20);

                //creating arrow connectable from prompt
                let conn2;
                if (this.currentlySelectedNode == null || isToggle) {
                    let tail = this.svgNode[index];

                    conn2 = rect.connectable({
                        type: 'angled',
                        targetAttach: 'perifery',
                        sourceAttach: 'perifery',
                        marker: 'default',
                    }, tail);

                } else {
                    conn2 = rect.connectable({
                        type: 'angled',
                        targetAttach: 'perifery',
                        sourceAttach: 'perifery',
                        marker: 'default',
                    }, this.currentlySelectedNode);
                }
                
                conn2.setConnectorColor("#000");
                conn2.connector.style('stroke-dasharray', "5");

                let connectorArr = r.getConnectors();
                connectorArr.push(new Connector(conn2.connector.node.id, null, connectorArr.length - 1));
                r.connectors = connectorArr;

                //push to a general array of prompt rect
                //push SVG object and connectors into the array
                this.idPrompt.push([r, index]);
                this.svgPrompt.push(rect);
                this.svgPromptConn.push(conn2.connector);
                this.svgText.push(text);

                //index in the idPrompt of the type of input
                rect.data({
                    key: this.idPrompt.length - 1,
                    text: text.node.id
                });

                //click event to add the process block in this area
                rect.click((event) => {

                    let newRect;
                    let index;
                    if (this.isEdit == false) {
                        this.isEdit = true;
                        index = this.addRect(this.idPrompt[rect.data('key')][0]);//removing all prompt rect and connectors
                        newRect = this.createProcessNodes(index, 0, true); 
                        this.isEdit = false;
                    } else {
                        index = this.addRect(this.idPrompt[rect.data('key')][0]);
                        newRect = this.createProcessNodes(index, 0, true);
                    }
                    this.removeSpecificPromptRect(rect.data('key'));
                    
                    if (this.head != null) {
                        this.head.stroke({ color: '#000000' });
                        this.head = null;
                        this.tail = null;
                    }
                    console.log(newRect.node.id);
                    //creating arrow connectable

                    let conn2 = newRect.connectable({
                        type: 'angled',
                        targetAttach: 'perifery',
                        sourceAttach: 'perifery',
                        marker: 'default',
                    }, SVG.get(this.project.processNodes[index].nextId[0]));
                    conn2.setConnectorColor("#ffa384");
                    conn2.connector.style('stroke-width', "3px");
                    conn2.connector.node.id = this.project.processNodes[index].connectors[0].id;
                    this.onSelectedNodeChange(null,null)
                });

            }
        }
        for (let i = 0; i < outputArr.length; i++) {
            let output = outputArr[i];
            let name = output.outputName;
            if (!this.isAttributeExistInNode(name,'output', rectObj)) {
                //create a prompt rect
                let x = rectObj.x;
                let y = rectObj.y;

                let promptRectInput = [];
                let inputObj = new MaterialInput();
                inputObj.materialName = name;
                inputObj.quantity = output.quantity;
                promptRectInput.push(inputObj);
                let xPrompt, yPrompt;
                if (x > this.processContainerWidth) {
                    xPrompt = x;
                } else {
                    xPrompt = x + 120
                }

                yPrompt = y - 100 + 80 * (i);
                if (yPrompt < 10) {
                    yPrompt = 15;
                }

                let r = new Rect(xPrompt, yPrompt, rectObj.id + i + 'output', [], [], rectObj.categories, name, promptRectInput, [], [], [], [], [])
                if (this.isPromptRectCreated(r.id)) {
                    continue;
                }

                let rect = this.draw.rect(100, 50);
                let text = this.draw.text('Click to add handle output of "' + name + '"');

                rect.node.id = r.id;
                //console.log(rect.node.id);
                rect.attr({
                    x: r.getX(),
                    y: r.getY(),
                    class: Rect,
                    fill: '#FFF',
                    'stroke-width': 1,
                    'stroke-dasharray': 5
                });


                text.attr({
                    id: rect.node.id + "text"
                });

                text.move(rect.x(), rect.y() - 20);

                //creating arrow connectable from prompt
                let conn2;
                if (this.currentlySelectedNode == null || isToggle) {
                    let head = this.svgNode[index];

                    conn2 = head.connectable({
                        type: 'angled',
                        targetAttach: 'perifery',
                        sourceAttach: 'perifery',
                        marker: 'default',
                    }, rect);

                } else {
                    conn2 = this.currentlySelectedNode.connectable({
                        type: 'angled',
                        targetAttach: 'perifery',
                        sourceAttach: 'perifery',
                        marker: 'default',
                    }, rect);
                }
                
                conn2.setConnectorColor("#000");
                conn2.connector.style('stroke-dasharray', "5");
                

                //include the new prompt into the general array
                this.idPrompt.push([r, index]);
                this.svgPrompt.push(rect);
                this.svgPromptConn.push(conn2.connector);
                this.svgText.push(text);
                //console.log(this.currentlySelectedNode);
                this.prevSVG.push(this.currentlySelectedNode);
                rect.data({
                    key: this.idPrompt.length - 1,
                    arrow: conn2.connector.node.id,
                    indexOfPrevSVG: this.prevSVG.length - 1,
                    text: text.node.id
                });

                //click event to add the process block in this area
                rect.click((event) => {
                    console.log(rect.data('key'));
                    let index;
                    console.log(this.idPrompt[rect.data('key')][0]);
                    let newRect;
                    if (this.isEdit == false) {
                        this.isEdit = true;
                        index = this.addRect(this.idPrompt[rect.data('key')][0]);
                        newRect = this.createProcessNodes(index, 0, true);
                        this.isEdit = false;
                    } else {
                        index = this.addRect(this.idPrompt[rect.data('key')][0]);
                        newRect = this.createProcessNodes(index, 0, true);
                    }
                    
                    //creating arrow connectable
                    let svgIndex = rect.data('indexOfPrevSVG');
                    let prevNode = this.prevSVG[svgIndex];
                    let conn2 = prevNode.connectable({
                        type: 'angled',
                        targetAttach: 'perifery',
                        sourceAttach: 'perifery',
                        marker: 'default',
                    }, newRect);
                    conn2.setConnectorColor("#ffa384");
                    conn2.connector.style('stroke-width', "3px");
                    let headObj = this.project.processNodes[prevNode.data('key')];
                    headObj.connectors.push(new Connector(conn2.connector.node.id, prevNode.data('key'), headObj.connectors.length));
                    headObj.nextId.push(this.project.processNodes[index].id);
                    //removing all prompt rect and connectors

                    this.removeSpecificPromptRect(rect.data('key'));
                    if (this.head != null) {
                        this.head.stroke({ color: '#000000' });
                        this.head = null;
                        this.tail = null;
                    }
                    this.onSelectedNodeChange(null, null)
                });

            }
        }
    }

    isAttributeExistInNode(name: string, att: String, rectObj: Rect) {
        switch (att) {
            case 'input':
                for (let i = 0; i < this.project.processNodes.length; i++) {
                    let node = this.project.processNodes[i];
                    for (let j = 0; j < node.nextId.length; j++) {
                        if (node.nextId[j] == rectObj.id) {
                            for (let k = 0; k < node.outputs.length; k++) {
                                let output = node.outputs[k];
                                if (output.outputName == name) {
                                    return true;
                                }
                            }
                        }
                    }
                }
                return false;
            case 'output':
                for (let i = 0; i < this.project.processNodes.length; i++) {
                    let node = this.project.processNodes[i];
                    for (let j = 0; j < rectObj.nextId.length; j++) {
                        if (node.id == rectObj.nextId[j]) {
                            for (let k = 0; k < node.materialInput.length; k++) {
                                let inputs = node.materialInput[k];
                                if (inputs.materialName == name) {
                                    return true;
                                }
                            }
                        }
                    }
                }
                return false;
        }
    }

    /**
     * Update relations between inputs and outputs of all nodes
     * WARNING: This is a quite expensive function. Don't call it too often
     */
    updateRelations() {
        var backwardMap = {};
        for (let fromNode of this.project.processNodes) {
            for (let next of fromNode.nextId) {
                var toNode = this.project.processNodes[this.processIdMap[next]['index']];
                //Add the relation to the backwardMap
                if (!backwardMap.hasOwnProperty(toNode.processName)) {
                    backwardMap[toNode.processName] = [];
                }
                this.addProcessToRelation(backwardMap[toNode.processName], fromNode.processName);
            }
        }
        //Loop through all nodes to assign their inputs
        for (let fromNode of this.project.processNodes) {
            for (let output of fromNode.outputs) {
                output.to = [];
                //Auto-assign to-process
                for (let next of fromNode.nextId) {
                    var toNode = this.project.processNodes[this.processIdMap[next]['index']];
                    //Iterate through all inputs
                    for (let input of toNode.materialInput) {
                        //Push into from/to array if matched
                        if (input.materialName.toLowerCase() == output.outputName.toLowerCase()) {
                            this.addProcessToRelation(input.from, fromNode.processName);
                            this.addProcessToRelation(output.to, toNode.processName);
                            //Update currently selected node, since it will be overwritten later if this is not done
                            var fromNodeIndex = this.project.processNodes.indexOf(fromNode);
                            if (this.currentlySelectedNode != undefined && this.currentlySelectedNode.data('key') == fromNodeIndex && this.selectedTab == this.outputMenuBar[0]) {
                                var outputIndex = fromNode.outputs.indexOf(output);
                                this.addProcessToRelation(this.outputList.at(outputIndex).value.to, toNode.processName);
                                //this.addProcessToRelation(output.to, toNode.processName);
                            }
                            var toNodeIndex = this.project.processNodes.indexOf(toNode);
                            if (this.currentlySelectedNode != undefined && this.currentlySelectedNode.data('key') == toNodeIndex && this.selectedTab == this.inputMenuBar[0]) {
                                var inputIndex = toNode.materialInput.indexOf(input);
                                //console.log(this.materialList.at(inputIndex).value.from)
                                this.addProcessToRelation(this.materialList.at(inputIndex).value.from, fromNode.processName);
                                
                                //this.addProcessToRelation(input.from, fromNode.processName);
                            }
                            if (this.isDisplayPrompt){
                                this.checkUnnecesaryPrompt(fromNodeIndex, toNodeIndex, outputIndex, inputIndex, input.materialName);
                            }
                            //console.log(fromNode, next);
                            break;
                        }
                    }
                }
                if (output.to.length == 0) {
                    output.to = [''];
                }
            }
        }

        //Loop through all inputs to delete obsolete fromProcess
        for (let node of this.project.processNodes) {
            var backwardRelation = backwardMap[node.processName];
            for (let input of node.materialInput) {
                for (var i = 0; i < input.from.length; i++) {
                    if (backwardRelation != undefined && !backwardRelation.includes(input.from[i])) {
                        input.from.splice(i, 1);
                    }
                }
                if (input.from.length == 0) {
                    input.from = [''];
                }
            }
        }
    }

    /**
     * Add a process relation to the from/to array of process in the specified input
     * @param tab currently selected tab
     * @param index index of the input within its respective list
     */
    addProcessRelation(tab: string, index: number) {
        switch (tab) {
            case this.inputMenuBar[0]:
                let fromControls = this.materialList.controls[index]['controls']['from'];
                console.log(fromControls);
                fromControls.push(this.fb.control(''));
                break;
            case this.outputMenuBar[0]:
                let toControls = this.outputList.controls[index]['controls']['to'];
                toControls.push(this.fb.control(''));
                break;
            default:
                return;
        }
    }

    /**
     * Make sure that no duplicate is added to the array
     * @param arr the array of relation to add to
     * @param processName name of the process to be added
     */
    private addProcessToRelation(arr: string[], processName: string) {
        var indexOfProc = arr.indexOf(processName);
        if (indexOfProc >= 0) {
            arr.splice(indexOfProc, 1);
        }
        arr.push(processName);
    }

    /**
     * Transform any array property of an object to a FormArray,
     * since FormBuilder cannot read array property
     * @param obj the object to be used by FormBuilder
     */
    private transformForFormBuilder(obj) {
        var clone = JSON.parse(JSON.stringify(obj));
        for (var property in clone) {
            if (clone.hasOwnProperty(property) && Array.isArray(clone[property])) {
                clone[property] = this.fb.array(clone[property]);
            }
        }
        return clone;
    }

    /**
     * Save the value of the select before a change
     * @param value old value before change
     */
    memorizeSelect(value) {
        this.previousSelect = value;
    }

    /**
     * Update the connectable based on the change
     * @param tab currently selected tab
     * @param index index of the input within its respective list
     * @param newValue value of the new select
     */
    updateConnection(tab: string, index: number, newValue) {
        var headName, headId, headIndex = null;
        var tailName, tailId, tailIndex = null;
        let previousNodeName, previousNodeId, previousNodeIndex = null;
        //Decide head/tail based on currently selected tab
        console.log(newValue);
        switch (tab) {
            case this.inputMenuBar[0]:
                headName = newValue;
                previousNodeName = this.previousSelect;
                break;
            case this.outputMenuBar[0]:
                previousNodeName = this.previousSelect;
                console.log(newValue);
                tailName = newValue;
                break;
            default:
                return;
        }
        console.log(previousNodeName, this.previousSelect)
        console.log(tailName);
        //Find the id of the head and the tail
        for (var i = 0; i < this.project.processNodes.length; i++) {
            var proc = this.project.processNodes[i];
            if (proc.processName == headName) {
                headId = proc.id;
                headIndex = i;
            } else if (proc.processName == tailName) {
                tailId = proc.id;
                tailIndex = i;
                console.log("i am hereeee");
            } else if (proc.processName == previousNodeName) {
                previousNodeId = proc.id;
                previousNodeIndex = i;
                console.log(i);
            }
        }

        //means currentlyselectednode is a tail
        let headObj;
        let connIndex;
        console.log(previousNodeName);
        if (previousNodeName == "") {
            //means adding a connection

            if (tab == this.inputMenuBar[0]) {
                tailIndex = this.currentlySelectedNode.data('key');
                console.log([tailIndex, headIndex])
                this.createConnection(headIndex, tailIndex);
            } else {
                headIndex = this.currentlySelectedNode.data('key');
                console.log([tailIndex, headIndex])
                this.createConnection(headIndex, tailIndex);
            }
        } else {
            if (tailName == null) {
                //means user changed the inputs of the currently selectedNode
                headObj = this.project.processNodes[headIndex];
                tailId = this.project.processNodes[this.currentlySelectedNode.data('key')].id;
                for (let i = 0; i < headObj.nextId.length; i++) {
                    if (headObj.nextId[i] == tailId) {
                        //form the connection
                        connIndex = i;
                        let headSVG = this.svgNode[headIndex];
                        let tailIndex = this.currentlySelectedNode.data('key');
                        let prevHeadObj = this.project.processNodes[previousNodeIndex];
                        let indexOfPrevConn;

                        

                        console.log(prevHeadObj);
                        //creation of connection
                        this.createConnection(headIndex, tailIndex);
                        //deletion of connection 

                        for (let i = 0; i < prevHeadObj.nextId.length; i++) {
                            if (prevHeadObj.nextId[i] == tailId) {
                                console.log('i am here');
                                indexOfPrevConn = i;
                                break;
                            }
                        }
                        console.log(indexOfPrevConn);
                        this.removeConnector([previousNodeIndex, indexOfPrevConn]);
                        break;
                    }
                }
                let previousRectObj = this.project.processNodes[previousNodeIndex];
                for (let i = 0; i < previousRectObj.nextId.length; i++) {
                    if (previousRectObj.nextId[i] == tailId) {
                        this.removeConnector([headIndex, i]);
                        break;
                    }
                }
            } else {
                //the currentlyselectedNode is a head 

                headObj = this.project.processNodes[headIndex];
                for (let i = 0; i < headObj.nextId.length; i++) {
                    if (headObj.nextId[i] == tailId) {
                        connIndex = i;
                        break;
                    }
                }
            }

        }
        console.log(tailName, "(" + tailId + ")", "is changed to", headName, "(" + headId + ")")
        //update connectors 


    }

    createConnection(indexHead, indexTail) {
        let headSVG = this.svgNode[indexHead];
        let tailSVG = this.svgNode[indexTail];
        let headObj = this.project.processNodes[indexHead];
        let tailObj = this.project.processNodes[indexTail];

        let conn2 = headSVG.connectable({
            type: 'angled',
            targetAttach: 'perifery',
            sourceAttach: 'perifery',
            marker: 'default',
        }, tailSVG);

        conn2.setConnectorColor("#ffa384");
        conn2.connector.style('stroke-width', "3px");

        headObj.nextId.push(tailObj.id);
        headObj.connectors.push(new Connector(conn2.connector.node.id, indexHead, headObj.connectors.length));
        
    }


    /**
     * Add a corresponding object to the appropriate data array, based on the current selected tab,
     * then fetch new data to the HTML inputs
     */
    addDetail(tab: string) {
        console.log('i am here');
        this.prepareForUndoableAction();
        this.saveAndClearDetails();
        let rectObj = this.project.processNodes[this.currentlySelectedNode.data('key')]
        switch (tab) {
            case this.inputMenuBar[0]:   //Material Input
                this.addInput(this.materialList);
                rectObj.materialInput = this.materialList.value;
                break;
            case this.inputMenuBar[1]:   //Energy Input
                this.addInput(this.energyList);
                rectObj.energyInputs = this.energyList.value;
                break;
            case this.inputMenuBar[2]:   //Transportation Input
                this.addInput(this.transportList);
                rectObj.transportations = this.transportList.value;
                break;
            case this.outputMenuBar[0]:   //Output
                this.addInput(this.outputList);
                rectObj.outputs = this.outputList.value;
                break;
            case this.outputMenuBar[1]:   //Byproduct
                this.addInput(this.byproductList);
                rectObj.byproducts = this.byproductList.value;
                break;
            case this.outputMenuBar[2]:   //Direct Emission
                this.addInput(this.emissionList);
                rectObj.directEmissions = this.emissionList.value;
                break;
        }
        this.project.processNodes[this.currentlySelectedNode.data('key')] = rectObj;
        //this.updateRelations();
        this.getDetails();
    }

    /**
     * Delete a corresponding object to the appropriate data array at the specified index,
     * based on the current selected tab, then fetch new data to the HTML inputs
     * @param tab name of the tab to delete from
     * @param index index of the input to delete
     */
    deleteDetail(tab: string, index: number) {
        this.prepareForUndoableAction();
        let rectObj = this.project.processNodes[this.currentlySelectedNode.data('key')];
        //console.log(rectObj.materialInput);
        switch (tab) {
            case this.inputMenuBar[0]:   //Material Input
                var materialInput = new MaterialInput();
                materialInput.parseData(this.materialList.at(index).value);
                if (!materialInput.equals(new MaterialInput())) {
                    this.removePromptRect(index, rectObj, 'input');
                }
                this.materialList.removeAt(index);
                rectObj.materialInput = this.materialList.value;
                break;
            
            case this.inputMenuBar[1]:   //Energy Input
                this.energyList.removeAt(index);
                rectObj.energyInputs = this.energyList.value;
                break;
            case this.inputMenuBar[2]:   //Transportation Input
                this.transportList.removeAt(index);
                rectObj.transportations = this.transportList.value;
                break;
            case this.outputMenuBar[0]:   //Output
                var output = new Output();
                output.parseData(this.outputList.at(index).value);
                if (!output.equals(new Output())) {
                    this.removePromptRect(index, rectObj, 'output');
                }


                this.outputList.removeAt(index);
                rectObj.outputs = this.outputList.value;
                break;
            case this.outputMenuBar[1]:   //Byproduct
                this.byproductList.removeAt(index);
                rectObj.byproducts = this.byproductList.value;
                break;
            case this.outputMenuBar[2]:   //Direct Emission
                this.emissionList.removeAt(index);
                rectObj.directEmissions = this.emissionList.value;
                break;
        }
        this.updateRelations();
        this.getDetails();
    }

    isPromptRectCreated(id: string) {
        for (let i = 0; i < this.idPrompt.length; i++) {
            if (this.idPrompt[i][0].id == id) {
                return true;
            }
        }
        return false;
    }

    /**
     * Collapse a corresponding detail to the appropriate data array at the specified index,
     * based on the current selected tab
     * @param tab name of the tab to collapse from
     * @param index index of the input to collapse
     */
    collapseDetail(tab: string, index: number) {
        let rectObj = this.project.processNodes[this.currentlySelectedNode.data('key')];
        switch (tab) {
            case this.inputMenuBar[0]:   //Material Input
                this.materialList.at(index).value.isCollapsed = true;
                rectObj.materialInput = this.materialList.value;
                break;
            case this.inputMenuBar[1]:   //Energy Input
                this.energyList.at(index).value.isCollapsed = true;
                rectObj.energyInputs = this.energyList.value;
                break;
            case this.inputMenuBar[2]:   //Transportation Input
                this.transportList.at(index).value.isCollapsed = true;
                rectObj.transportations = this.transportList.value;
                break;
            case this.outputMenuBar[0]:   //Output
                this.outputList.at(index).value.isCollapsed = true;
                rectObj.outputs = this.outputList.value;
                break;
            case this.outputMenuBar[1]:   //Byproduct
                this.byproductList.at(index).value.isCollapsed = true;
                rectObj.byproducts = this.byproductList.value;
                break;
            case this.outputMenuBar[2]:   //Direct Emission
                this.emissionList.at(index).value.isCollapsed = true;
                rectObj.directEmissions = this.emissionList.value;
                break;
        }
    }

    /**
     * Collapse all details to the appropriate data array based on the current selected tab
     * @param tab name of the tab to collapse from
     */
    collapseAll(tab: string) {
        let rectObj = this.project.processNodes[this.currentlySelectedNode.data('key')];
        switch (tab) {
            case this.inputMenuBar[0]:   //Material Input
                for (var i = 0; i < this.materialList.length; i++) {
                    this.materialList.at(i).value.isCollapsed = true;
                }
                rectObj.materialInput = this.materialList.value;
                break;
            case this.inputMenuBar[1]:   //Energy Input
                for (var i = 0; i < this.energyList.length; i++) {
                    this.energyList.at(i).value.isCollapsed = true;
                }
                rectObj.energyInputs = this.energyList.value;
                break;
            case this.inputMenuBar[2]:   //Transportation Input
                for (var i = 0; i < this.transportList.length; i++) {
                    this.transportList.at(i).value.isCollapsed = true;
                }
                rectObj.transportations = this.transportList.value;
                break;
            case this.outputMenuBar[0]:   //Output
                for (var i = 0; i < this.outputList.length; i++) {
                    this.outputList.at(i).value.isCollapsed = true;
                }
                rectObj.outputs = this.outputList.value;
                break;
            case this.outputMenuBar[1]:   //Byproduct
                for (var i = 0; i < this.byproductList.length; i++) {
                    this.byproductList.at(i).value.isCollapsed = true;
                }
                rectObj.byproducts = this.byproductList.value;
                break;
            case this.outputMenuBar[2]:   //Direct Emission
                for (var i = 0; i < this.emissionList.length; i++) {
                    this.emissionList.at(i).value.isCollapsed = true;
                }
                rectObj.directEmissions = this.emissionList.value;
                break;
        }
    }

    /**
     * Expand a corresponding detail to the appropriate data array at the specified index,
     * based on the current selected tab
     * @param tab name of the tab to expand from
     * @param index index of the input to expand
     */
    expandDetail(tab: string, index: number) {
        let rectObj = this.project.processNodes[this.currentlySelectedNode.data('key')];
        switch (tab) {
            case this.inputMenuBar[0]:   //Material Input
                this.materialList.at(index).value.isCollapsed = false;
                rectObj.materialInput = this.materialList.value;
                break;
            case this.inputMenuBar[1]:   //Energy Input
                this.energyList.at(index).value.isCollapsed = false;
                rectObj.energyInputs = this.energyList.value;
                break;
            case this.inputMenuBar[2]:   //Transportation Input
                this.transportList.at(index).value.isCollapsed = false;
                rectObj.transportations = this.transportList.value;
                break;
            case this.outputMenuBar[0]:   //Output
                this.outputList.at(index).value.isCollapsed = false;
                rectObj.outputs = this.outputList.value;
                break;
            case this.outputMenuBar[1]:   //Byproduct
                this.byproductList.at(index).value.isCollapsed = false;
                rectObj.byproducts = this.byproductList.value;
                break;
            case this.outputMenuBar[2]:   //Direct Emission
                this.emissionList.at(index).value.isCollapsed = false;
                rectObj.directEmissions = this.emissionList.value;
                break;
        }
        this.getDetails();
    }

    /**
     * Expand all details to the appropriate data array based on the current selected tab
     * @param tab name of the tab to expand from
     */
    expandAll(tab: string) {
        let rectObj = this.project.processNodes[this.currentlySelectedNode.data('key')];
        switch (tab) {
            case this.inputMenuBar[0]:   //Material Input
                for (var i = 0; i < this.materialList.length; i++) {
                    this.materialList.at(i).value.isCollapsed = false;
                }
                rectObj.materialInput = this.materialList.value;
                break;
            case this.inputMenuBar[1]:   //Energy Input
                for (var i = 0; i < this.energyList.length; i++) {
                    this.energyList.at(i).value.isCollapsed = false;
                }
                rectObj.energyInputs = this.energyList.value;
                break;
            case this.inputMenuBar[2]:   //Transportation Input
                for (var i = 0; i < this.transportList.length; i++) {
                    this.transportList.at(i).value.isCollapsed = false;
                }
                rectObj.transportations = this.transportList.value;
                break;
            case this.outputMenuBar[0]:   //Output
                for (var i = 0; i < this.outputList.length; i++) {
                    this.outputList.at(i).value.isCollapsed = false;
                }
                rectObj.outputs = this.outputList.value;
                break;
            case this.outputMenuBar[1]:   //Byproduct
                for (var i = 0; i < this.byproductList.length; i++) {
                    this.byproductList.at(i).value.isCollapsed = false;
                }
                rectObj.byproducts = this.byproductList.value;
                break;
            case this.outputMenuBar[2]:   //Direct Emission
                for (var i = 0; i < this.emissionList.length; i++) {
                    this.emissionList.at(i).value.isCollapsed = false;
                }
                rectObj.directEmissions = this.emissionList.value;
                break;
        }
        this.getDetails();
    }

    /**
     * On change tab
     * @param tab string passed from process.html to set this.selectedTab to the tab that is changed/clicked
     */
    changeTab(tab) {
        this.saveAndClearDetails();
        this.selectedTab = tab;
        this.getDetails();
    }

    //================================================================
    //                 MOUSE-KEYBOARD EVENTS
    //================================================================
    @HostListener('document:keydown', ['$event'])
    handleKeyboardEvent(event: KeyboardEvent) {
        switch (event.key) {
            //Arrow key events for ease of navigation
            case 'Home':        //For debugging purposes
                console.log(this.filteredOptions);
                break;
            case 'End':
                console.log(this.outputList.value);
                break;
            case 'ArrowLeft':
                if (document.activeElement.nodeName != 'BODY') {
                    break;
                }
                if (this.currentlySelectedNode != null) {
                    this.saveAndClearDetails();
                }
                this.navPrev();
                break;
            case 'ArrowRight':
                if (document.activeElement.nodeName != 'BODY') {
                    break;
                }
                if (this.currentlySelectedNode != null) {
                    this.saveAndClearDetails();
                }
                this.navNext();
                break;
            case 'Enter':
                console.log(this.idPrompt, this.svgPrompt);
            default:
                //Other keyboard events for editing
                if (event.ctrlKey && event.key == 'z') {
                    this.undo();
                } else if (event.ctrlKey && event.key == 'y') {
                    this.redo();
                } else if (event.ctrlKey && event.key == 's') {
                    this.saveElsewhere();
                }
                break;
        }
    }

    //detecting the posistion of the mouse
    @HostListener('mousemove', ['$event'])
    onMousemove(event: MouseEvent) {
        this.mouseX = event.clientX;
        this.mouseY = event.clientY;
        if (this.isAbandonedNodesSelected) {
        }
    }

    //Hide suggestions when scroll
    @HostListener('mousewheel') scrolling() {
        this.filteredOptions = [];
        this.filteredEmissions = [];
    }

    /**
     * When the mouse double clicks on the process container in process.html, creates a node
     * */
    onDblClick() {
        if (this.isEdit) {
            let result = this.allocatingLifeStages(this.mouseX - this.svgOffsetLeft);

            let rectObj = new Rect(this.mouseX - this.svgOffsetLeft - result[1], this.mouseY - this.svgOffsetTop, this.project.processNodes.length,
                [], [], this.project.lifeCycleStages[result[0]], "", [], [], [], [], [], []);
            let indexInProcessNodes = this.addRect(rectObj);
            this.createProcessNodes(indexInProcessNodes, result[1], true);
        } else {
            const dialogConfig = new MatDialogConfig();
            dialogConfig.disableClose = true;
            dialogConfig.autoFocus = true;
            dialogConfig.data = {
                id: 1,
                text: 'Click "Edit" to start adding processes and linking up processes'
            };
            const dialogRef = this.dialog.open(Dialog, dialogConfig);
            dialogRef.afterClosed().subscribe(result => {
                console.log(' Dialog was closed')
            });
        }
    }

    /**
     * on window resize 
     * */
    onResize() {
        window.clearTimeout(this.waitId);
        //wait for resize to be over
        this.waitId = setTimeout(() => {
            this.doneResize();
        }, 500);
    }

   /**
    * Waiting resize to finish
    * */
    doneResize() {
        this.draw.clear();
        this.generatingComponents();
        this.generatingProcessNodes();
        this.head = null;
        this.tail = null;
    }

    //================================================================
    //                 NODES-RELATED FUNCTIONS
    //================================================================
    /**
     * Pre-processing of abandoned nodes
     * 
     * @param r Rect object of unallocated node retrieved from processNodes
     * @param index index of unallocated node in abandonedNodes array
      * @param indexAtProcess index of unallcoate node in the processNodes array
     */
    createAbandonedNodes(r: Rect, index, indexAtProcess) {
        var rect = this.abandonedDraw.rect(100, 50);
        let text = this.abandonedDraw.text(r.processName)

        rect.attr({
            x: 55,
            y: 20 * ( index + 1),
            id: r.getId(),
            class: Rect,
            fill: '#FFF',
            'stroke-width': 1,
        });
        rect.data('key', indexAtProcess);
        rect.draggy();
        //At the end of the dragging, check which category is the box in
        text.attr({
            id: rect.node.id + "text"
        });

        text.move(rect.x() + 25, rect.y() + 12.5);

        rect.on('dragmove', (event) => {
            text.remove();
            let rectObj = this.project.processNodes[rect.data('key')];
            if (rect.x() > this.svgabandoned.nativeElement.offsetWidth && this.transferedRect == null) {
                let r = new Rect(this.mouseX - this.svgOffsetLeft - this.svgabandoned.nativeElement.offsetWidth, this.mouseY - this.svgOffsetTop,
                    rectObj.id, rectObj.nextId, rectObj.connectors, this.lifeCycleStages[0], rectObj.processName, rectObj.materialInput, rectObj.outputs, rectObj.byproducts, rectObj.energyInputs, rectObj.transportations, rectObj.directEmissions);
                this.project.processNodes[rect.data('key')] = r;
                this.transferedRect = this.createProcessNodes(rect.data('key'), 0, false);
            } else {
                
            }
            if (this.transferedRect != null) {
                //this.transferedRect.move(this.mouseX - this.svgOffsetLeft - this.svgabandoned.nativeElement.offsetWidth, this.mouseY - this.svgOffsetTop);
                this.transferedRect.move(rect.x() - this.svgabandoned.nativeElement.offsetWidth, this.mouseY - this.svgOffsetTop);
            }
        });

        rect.on('dragend', (event) => {
            if (rect.x() <= this.svgabandoned.nativeElement.offsetWidth && this.transferedRect == null) {
                rect.attr({
                    x: 55,
                    y: 20 * (index + 1)
                });
            } else {
                this.abandonedNodes.splice(index, 1);
                let result = this.allocatingLifeStages(rect.x());
                let rectObj = this.project.processNodes[rect.data('key')];
                this.project.processNodes[rect.data('key')] = new Rect(rect.x() - this.svgabandoned.nativeElement.offsetWidth - result[1], rect.y(), rectObj.id, rectObj.nextId,
                    rectObj.connectors, this.lifeCycleStages[result[0]], rectObj.processName, rectObj.materialInput, rectObj.outputs, rectObj.byproducts, rectObj.energyInputs, rectObj.transportations, rectObj.directEmissions);
                
                rect.remove();
                //TODO:
                //need take acount to shift out and shift in 
            }
            this.transferedRect = null;
        });

        rect.click((event) => {
            //check if the node is clicked
            //true: change the border color to black remove pointer to the node
            //false: change the border to blue, point to the node
            let rectObj = this.project.processNodes[rect.data('key')];
            if (rect == this.currentlySelectedNode) {
                rect.stroke({ color: '#000000' });
                this.head = null;
            } else {
                rect.stroke({ color: '#4e14e0' });
                if (this.head == null) {
                    this.head = rect;
                } else {
                    this.tail = rect;
                }
            }
        });

        //removing the processNode
        rect.on("contextmenu", (event) => {
            this.removeRect(rect, text);
        });
    }

    /**
     * Creating nodes in process componet
     * @param index, index of the node in project.processNodes array
     * @param width, width of the compartment for scaling purposes 
     * @param isDoubleClick, whether is is pre-processing of nodes or addition of nodes due to double click
     * */
    createProcessNodes(index, width, isDoubleClick: Boolean) {
        let r = this.project.processNodes[index];
        let rect = this.draw.rect(100, 50);
        let text = this.draw.text(r.processName);

        if (isDoubleClick) {
            rect.attr({
                x: r.getX() + width,
                y: r.getY(),
                class: Rect,
                fill: '#FFF',
                'stroke-width': 1,
            });
            r.setId(rect.node.id);
        } else {
            //scaling 
            let index = this.project.lifeCycleStages.indexOf(r.getCategories());
            let scalingFactor = this.project.dimensionArray[index] / this.previousDimensionArray[index];
            let x = r.getX() * scalingFactor;
            rect.attr({
                x: x + width,
                y: r.getY(),
                id: r.getId(),
                class: Rect,
                fill: '#FFF',
                'stroke-width': 1,
            });
            r.setX(x);
        }
        rect.data('key', index);    //saving the index of the data for this node pointing to project.processNodes
        rect.draggy({
            minX: 0,
            minY: 0,
            maxX: this.processContainerWidth,
            maxY: this.processContainerHeight
        });

        text.attr({
            id: rect.node.id + "text"
        });

        text.move(rect.x(), rect.y() - 20);

        //if onclick set the border color
        if (!rect.data('key').isClicked) {
            rect.stroke({ color: '#000000' });
        } else {
            rect.stroke({ color: '#4e14e0' });
        }
        rect.on('dragmove', (event) => {
            text.move(rect.x(), rect.y() - 20)
        });

        //At the end of the dragging, check which category is the box in
        rect.on('dragend', (event) => {
            this.prepareForUndoableAction();
            let result = this.allocatingLifeStages(rect.x());
            let oldObj = this.project.processNodes[rect.data('key')];
            let rectObj = new Rect(rect.x() - result[1], rect.y(), oldObj.id, oldObj.nextId, oldObj.connectors, this.lifeCycleStages[result[0]], oldObj.processName, oldObj.materialInput, oldObj.outputs, oldObj.byproducts, oldObj.energyInputs, oldObj.transportations, oldObj.directEmissions);
            this.updateRect(rect.data('key'), rectObj);
        });

        //click event to connect two process block together
        rect.click((event) => {
            if (this.isEdit) {
                //get rect object 
                let rectObj = this.project.processNodes[rect.data('key')];
                //check if the node is clicked
                //true: change the border color to black remove pointer to the node
                //false: change the border to blue, point to the node
                if (rect == this.currentlySelectedNode) {
                    rect.stroke({ color: '#000000' });
                    this.head = null;
                } else {
                    rect.stroke({ color: '#ffa384' });
                    if (this.head == null) {
                        this.head = rect;
                    } else {
                        this.tail = rect;
                    }
                }

                //If two nodes are selected remove the details and connect them together
                //remove pointer
                if (this.head != null && this.tail != null && this.head != this.tail) {
                    if (this.checkIfLinkExist()) {
                        //deselecting the boxes
                        this.head.stroke({ color: '#000000' });
                        this.tail.stroke({ color: '#000000' })
                        this.head = null;
                        this.tail = null;
                        return;
                    }
                    //creating arrow connectable
                    let conn2 = this.head.connectable({
                        type: 'angled',
                        targetAttach: 'perifery',
                        sourceAttach: 'perifery',
                        marker: 'default',
                    }, this.tail);
                    conn2.setConnectorColor("#ffa384");
                    conn2.connector.style('stroke-width', "3px");

                    //deselecting the boxes
                    this.head.stroke({ color: '#000000' });
                    this.tail.stroke({ color: '#000000' });
                    //pushing connectors and nextId into the objects
                    this.prepareForUndoableAction();
                    let headObj = this.project.processNodes[this.head.data('key')];
                    let nextIdArray: string[] = headObj.nextId;
                    let connectorsArray = headObj.connectors;
                    nextIdArray.push(rectObj.id);
                    //creating a new connector object
                    connectorsArray.push(new Connector(conn2.connector.node.id, this.getCorrespondingRect(this.head).i, connectorsArray.length));
                    //[index of head in processNodes, index of connector in head]
                    conn2.connector.data('key', [this.getCorrespondingRect(this.head).i, connectorsArray.length - 1]);

                    //set connectorArray and nextIdArray for head object
                    headObj.nextId = nextIdArray;
                    headObj.connectors = connectorsArray;

                    //update tail
                    this.updateRect(this.head.data('key'), headObj);

                    this.head = null;
                    this.tail = null;

                    //remove the arrow if right clicked of it
                    conn2.connector.on('contextmenu', (event) => {
                        this.removeConnector(conn2.connector.data('key'));
                        conn2.connector.remove();
                    })

                }
                this.updateRect(rect.data('key'), rectObj);
                this.onSelectedNodeChange(rect, text);
                this.updateRelations();
            } else {
                if (this.currentlySelectedNode == null) {
                    this.currentlySelectedNode = rect;
                    this.currentlySelectedText = text;
                    this.currentlySelectedNode.stroke({ color: '#ffa384' })
                } else {
                    this.currentlySelectedNode.stroke({ color: '#000000' })
                    this.saveAndClearDetails();
                    this.updateRelations();
                    this.currentlySelectedNode = rect;
                    this.currentlySelectedText = text;
                    this.currentlySelectedNode.stroke({ color: '#ffa384' })
                }
                this.head = this.currentlySelectedNode;
                this.currentlySelectedNodeName = this.project.processNodes[this.currentlySelectedNode.data('key')].processName;
                this.selectedTab = this.inputMenuBar[0];
                this.getDetails();
            }
        });

        //removing the processNode
        rect.on("contextmenu", (event) => {
            this.removeRect(rect, text);
        });

        //Highlight the selected node from result component
        if (this.isNavFromResult()) {
            if (rect.node.id == this.navFromResult['processId']) {
                this.currentlySelectedNode = rect;
                this.cd.detectChanges();                //To remedy *ngIf check in HTML file
                this.currentlySelectedText = text;
                this.currentlySelectedNode.stroke({ color: '#ffa384' })
                this.getDetails();
                switch (this.navFromResult['tab']) {
                    case '1':
                        for (let input of this.project.processNodes[this.currentlySelectedNode.data('key')].materialInput) {
                            if (input.materialName.toLowerCase() == this.navFromResult['name'].toLowerCase()) {
                                input.isCollapsed = false;
                            } else {
                                input.isCollapsed = true;
                            }
                        }
                        this.getDetails();
                        break;
                    case '4': 
                        for (let output of this.project.processNodes[this.currentlySelectedNode.data('key')].outputs) {
                            if (output.outputName.toLowerCase() == this.navFromResult['name'].toLowerCase()) {
                                output.isCollapsed = false;
                            } else {
                                output.isCollapsed = true;
                            }
                        }
                        this.changeTab(this.outputMenuBar[0]);
                        break;
                    case '6':
                        for (let emission of this.project.processNodes[this.currentlySelectedNode.data('key')].directEmissions) {
                            if (emission.emissionType.toLowerCase() == this.navFromResult['name'].toLowerCase()) {
                                emission.isCollapsed = false;
                            } else {
                                emission.isCollapsed = true;
                            }
                        }
                        this.changeTab(this.outputMenuBar[2]);
                        break;
                    default: break;
                }
            }
        }

        this.processIdMap[rect.node.id] = {
            name: r.processName,
            index: index
        }
        this.svgNode.push(rect);
        return rect;
    }


    /**
     * Show a confirmation dialog when user wants to establish a link between two nodes that has existing link
     */
    showLinkExistWarning() {
        /*const { dialog } = require("electron").remote;
        //Call to the current window to make the dialog a modal
        const { BrowserWindow } = require('electron').remote;
        var WIN = BrowserWindow.getFocusedWindow();
        const options = {
            type: 'warning',
            buttons: ['Ok'],
            defaultId: 1,
            title: 'Warning',
            message: 'Unable to establish link',
            detail: 'link already exist',
        };
        dialog.showMessageBox(WIN, options);*/
    }

    /**
     * pre-procssing of connectors 
     * 
     * @param head the head node
     * @param tail the tail node
     * @param connectorObj the connector object 
     */
    creatingProcessLinks(head, tail, connectorObj) {
        var conn2 = head.connectable({
            type: 'angled',
            targetAttach: 'perifery',
            sourceAttach: 'perifery',
            marker: 'default',
        }, tail);
        conn2.setConnectorColor("#ffa384");
        conn2.connector.style('stroke-width', "3px");
        conn2.connector.node.id = connectorObj.id;
        conn2.connector.data('key', [this.getCorrespondingRect(head).i, connectorObj.index]);
        
        //removing connector on right click
        conn2.connector.on('contextmenu', (event) => {
            this.removeConnector(conn2.connector.data('key'));
            conn2.connector.remove();
        });
    }

   
    /**
     * When there is a change in selection of nodes, display the correct containers/ remove the correct containers
     * 
     * @param rect the node that was clicked on
     */
    onSelectedNodeChange(rect: SVG.Rect, text: SVG.Text) {
        if (this.head == null && this.tail == null || rect == this.currentlySelectedNode) {
            this.saveAndClearDetails();
            this.currentlySelectedNode = null;
            this.currentlySelectedText = null;
        }  else {
            this.currentlySelectedNode = rect;
            this.currentlySelectedText = text;
            this.currentlySelectedNodeName = this.project.processNodes[this.currentlySelectedNode.data('key')].processName;
            this.selectedTab = this.inputMenuBar[0];
            this.getDetails();
        }

    }
    /**
     * Adds a node to process component
     *
     * @param rect A rect Object
     */
    addRect(rect: Rect) {
        if (this.isEdit) {
            this.prepareForUndoableAction();
            if (rect.processName == "") {
                rect.processName = "P" + (this.project.processNodes.length + 1);
            }
            this.project.processNodes.push(rect);
            return this.project.processNodes.length - 1;
        }
    }
    /**
     * remove the connector details from the rect object
     * @param connectorToBeRemoved: An array with [headIndex, indexOfConnector]
     * */
    removeConnector(connectorToBeRemoved) {
        var thisNode = this.project.processNodes[connectorToBeRemoved[0]];
        console.log(thisNode);
        var thatNodeId = thisNode.getNext()[connectorToBeRemoved[1]];
        console.log(thatNodeId);
        var thatNode = this.project.processNodes[this.processIdMap[thatNodeId]['index']];
        thisNode.getConnectors().splice(connectorToBeRemoved[1], 1);
        thisNode.getNext().splice(connectorToBeRemoved[1], 1);
        //Remove all fromProcess in thatNode's materialInput that is pointing to thisNode
        for (let input of thatNode.materialInput) {
            var index = input.from.indexOf(thisNode.processName);
            if (index >= 0) {
                input.from.splice(index, 1);
            }
        }
        this.updateRelations();
        this.getDetails();
    }

    /**
     * Removing a node from the process component 
     * 
     * @param rect A rect object
     */
    removeRect(rect: SVG.Rect, text: SVG.Text) {
        if (this.isEdit) {

            const dialogConfig = new MatDialogConfig();
            dialogConfig.disableClose = true;
            dialogConfig.autoFocus = true;
            dialogConfig.data = {
                id: 1,
                text: 'Confirm deletion of process?',
                action: 'delete'
            };
            const dialogRef = this.dialog.open(confirmationDialog, dialogConfig);
            dialogRef.afterClosed().subscribe(result => {
                console.log(' Dialog was closed')
                if (result) {
                    let index = rect.data('key');
                    this.prepareForUndoableAction();


                    for (let i = 0; i < this.project.processNodes.length; i++) {
                        for (let j = 0; j < this.project.processNodes[i].getNext().length; j++) {
                            let next = this.project.processNodes[i].getNext()[j];
                            if (rect.node.id == next) {
                                SVG.get(this.project.processNodes[i].getConnectors()[j].id).remove();
                                this.project.processNodes[i].getNext().splice(j, 1);
                                this.project.processNodes[i].getConnectors().splice(j, 1);
                                j--;
                            }
                        }
                    }
                    let removedIndex = null;
                    for (let i = 0; i < this.project.processNodes.length; i++) {
                        if (this.project.processNodes[i].getId() == rect.node.id) {
                            //remove processlinks
                            for (let j = 0; j < this.project.processNodes[i].getNext().length; j++) {
                                //logic to be resolved
                                if (SVG.get(this.project.processNodes[i].getConnectors()[j].id) != null) {
                                    SVG.get(this.project.processNodes[i].getConnectors()[j].id).remove();
                                }
                            }
                            removedIndex = i;
                        } else if (removedIndex != null && i != 0) {
                            //changing all index of remaning nodes
                            SVG.get(this.project.processNodes[i].id).data('key', i - 1);
                        }
                        
                        //after reaching the end, we then remove the node that was meant to remove
                        if (i == this.project.processNodes.length - 1) {
                            this.project.processNodes.splice(removedIndex, 1);
                            this.removeAllPromptRect();
                            if (this.currentlySelectedNode == rect) {
                                this.head = null;
                                this.currentlySelectedNode = null;
                            }
                            rect.remove();
                            text.remove();
                        }

                    }
                  delete this.processIdMap[rect.node.id];
                }
            });
        }
    }


    removeAllPromptRect() {
        for (let i = 0; i < this.idPrompt.length; i++) {
            SVG.get(this.svgPrompt[i].node.id).remove();
            SVG.get(this.svgPromptConn[i].node.id).remove();
            SVG.get(this.svgText[i].node.id).remove();
        }
        this.svgPrompt = [];
        this.svgPromptConn = [];
        this.svgText = [];
        this.idPrompt = [];
    }

    //remove all prompt rect linking to the node 
    removeConnectedPromptRect(index: Number) {
        let removedIndex = [];
        for (let i = 0; i < this.idPrompt.length; i++) {
            if (this.idPrompt[i][1] == index) {
                SVG.get(this.svgPrompt[i].node.id).remove();
                SVG.get(this.svgPromptConn[i].node.id).remove();
                SVG.get(this.svgText[i].node.id).remove();
               
                removedIndex.push(i);
            }
        }
        for (let i = 0; i < removedIndex.length; i++) {
            this.idPrompt.splice(removedIndex[i], 1);
            this.svgPrompt.splice(i, 1);
            this.svgPromptConn.splice(i, 1);
            this.svgText.splice(i, 1);
        }
    }

    /**
     * 
     * @param index index of promptRect in the idPrompt Array
     */
    removeSpecificPromptRect(index) {

        //removing SVG elements in the user interface
        SVG.get(this.svgPrompt[index].node.id).remove();
        SVG.get(this.svgPromptConn[index].node.id).remove();
        SVG.get(this.svgText[index].node.id).remove();

        for (let i = index + 1; i < this.idPrompt.length; i++) {
            SVG.get(this.svgPrompt[i].node.id).data('key', i - 1);
        }

        this.idPrompt.splice(index, 1);
        this.svgPrompt.splice(index, 1);
        this.svgPromptConn.splice(index, 1);
        this.svgText.splice(index, 1);
    }

    //removing prompt rect if deleted from the details section
    //for removing of promptRect by deleting a detail in the detail section
    removePromptRect(index: number, rectObj: Rect, option: string) {
        if (this.isDisplayPrompt) {
            let indexToRemove = null;
            let j = index + 1;
            for (let i = 0; i < this.idPrompt.length; i++) {
                switch (option) {
                    case 'input':

                        if (this.idPrompt[i][0].id == rectObj.id + index + 'input') {
                            indexToRemove = i;
                        } else if (indexToRemove != null && this.idPrompt[i][0].id == rectObj.id + j + 'input') {
                            let newIndex = j - 1;
                            SVG.get(rectObj.id + j + 'input').node.id = rectObj.id + newIndex + 'input';
                            this.idPrompt[i][0].id = rectObj.id + newIndex + 'input';
                            j++;
                        }
                        break;
                    case 'output':
                        if (this.idPrompt[i][0].id == rectObj.id + index + 'output') {
                            indexToRemove = i;
                        } else if (indexToRemove != null && this.idPrompt[i][0].id == rectObj.id + j + 'output') {
                            let newIndex = j - 1;
                            SVG.get(rectObj.id + j + 'output').node.id = rectObj.id + newIndex + 'output';
                            this.idPrompt[i][0].id = rectObj.id + newIndex + 'output';
                            j++;
                        }
                        break;
                }
            }
            switch (option) {
                case 'input':
                    let svgRect = SVG.get(rectObj.id + index + 'input');
                    if (svgRect == null)
                        return;
                    let ind = svgRect.data('key');
                    SVG.get(rectObj.id + index + 'input').remove();
                    SVG.get(this.svgPromptConn[ind].node.id).remove();
                    SVG.get(this.svgText[ind].node.id).remove();
                    break;
                case 'output':
                    let svgRectOut = SVG.get(rectObj.id + index + 'output');
                    if (svgRectOut == null)
                        return;
                    let indOut = svgRectOut.data('key');
                    SVG.get(svgRectOut.data('arrow')).remove();
                    SVG.get(rectObj.id + index + 'output').remove();
                    SVG.get(this.svgText[indOut].node.id).remove();
                    break;
            }

            this.idPrompt.splice(indexToRemove, 1);
            this.svgPrompt.splice(indexToRemove, 1);
            this.svgText.splice(indexToRemove, 1);
            this.svgPromptConn.splice(indexToRemove, 1);

            //re ordering index key for all SVG Rect
            for (let i = indexToRemove; i < this.idPrompt.length; i++) {
                let svgObj = SVG.get(this.idPrompt[i][0].id);
                svgObj.data('key', i);
            }

        } else {
        }
    }


    /**
     * 
     * @param rectObj
     * @param index index of the head/tail
     */
    checkUnnecesaryPrompt(indexOut: Number, indexIn: Number, materialOutIndex, materialInIndex, name: string) {
        let removedPrompt = [];
        for (let i = 0; i < this.idPrompt.length; i++) {
            if (this.idPrompt[i][1] == indexOut || this.idPrompt[i][1] == indexIn) {
                
                let output = this.idPrompt[i][0].outputs[materialOutIndex];
                let input = this.idPrompt[i][0].materialInput[materialInIndex];
                if (output != undefined && input != undefined) {
                    if (output.outputName == name || input.materialName == name) {
                        SVG.get(this.svgPrompt[i].node.id).remove();
                        SVG.get(this.svgPromptConn[i].node.id).remove();
                        SVG.get(this.svgText[i].node.id).remove();
                        removedPrompt.push(i);
                        break;
                    }
                } else if (input != undefined) {
                    if (input.materialName == name) {
                        SVG.get(this.svgPrompt[i].node.id).remove();
                        SVG.get(this.svgPromptConn[i].node.id).remove();
                        SVG.get(this.svgText[i].node.id).remove();
                        removedPrompt.push(i);
                        break;
                    }
                } else if (output != undefined) {
                    if (output.outputName == name) {
                        SVG.get(this.svgPrompt[i].node.id).remove();
                        SVG.get(this.svgPromptConn[i].node.id).remove();
                        SVG.get(this.svgText[i].node.id).remove();
                        removedPrompt.push(i);
                        break;
                    }
                } else {
                }
            }
        }
        for (let i = 0; i < removedPrompt.length; i++) {
            this.idPrompt.splice(removedPrompt[i], 1);
            this.svgPrompt.splice(removedPrompt[i], 1);
            this.svgPromptConn.splice(removedPrompt[i], 1);
            this.svgText.splice(removedPrompt[i], 1);

        }

        //update index
        //re ordering index key for all SVG Rect

        for (let i = 0; i < this.idPrompt.length; i++) {
            let svgObj = SVG.get(this.idPrompt[i][0].id);
            svgObj.data('key', i);
        }
    }
    /**
     * update data of the node at project.processNodes
     * 
     * @param index index of the position of the rect node data is stored, if null, searches through the data to find the correct id 
     * @param rectObj the data of the updated object
     */
    updateRect(index: number, rectObj: Rect) {
        if (index != null) {
            this.project.processNodes[index] = rectObj;
        } else {
            for (let i = 0; i < this.project.processNodes.length; i++) {
                let dataNode = this.project.processNodes[i];
                if (dataNode.id == rectObj.id) {
                    this.project.processNodes[i] = rectObj;
                }
            }
        }
    
    }
    
    /**
     * check the position of the node to allocate to certain lifecycle stages
     * 
     * @param position
     * @returns index of the lifecyclestage the node is at
     * @returns accumulatedwidth of the lifecycle stage the node is at
     */
    allocatingLifeStages(position) {
        let index = 0;
        let accumulatedWidth = 0;
        for (let i = 0; i < this.lifeCycleStages.length; i++) {
            if (position < accumulatedWidth) {
                accumulatedWidth -= this.project.dimensionArray[i];
                return [ index - 1, accumulatedWidth ];
            } else {
                accumulatedWidth += this.project.dimensionArray[i];
                index++;
            }
        }
        accumulatedWidth -= this.project.dimensionArray[index - 1];
        return [index - 1, accumulatedWidth];
    }

    /**
     * onclick add button which manually add a node in process component
     * */
    addProcessNodeEvent() {
        this.isEdit = false;
        this.editMode();
        let stageIndex = 0;
        let rectObj = new Rect(this.svgOffsetLeft, 10, this.project.processNodes.length, [], [], this.project.lifeCycleStages[stageIndex], "", [], [], [], [], [], []);
        let index = this.addRect(rectObj);
        this.createProcessNodes(index,0, true);
    }

    /**
     * onclick delete button to delete a process node
     * */
    deleteProcessNodeEvent() {
        this.isEdit = false;
        this.editMode();
        this.removeRect(this.currentlySelectedNode, this.currentlySelectedText);
    }

    /**
     * onclick zoom in button to increase the size of every node
     * */
    zoomIn() {
        this.size += 10;
        for (let i = 0; i < this.project.processNodes.length; i++) {
            var rect = SVG.get(this.project.processNodes[i].id)
            rect.attr({
                width: this.size,
                height: 50/100*this.size
            })
        }
    }

    /**
     * onclick zoom out button to decrease the size of every node
     * */
    zoomOut() {
        this.size -= 10;
        for (let i = 0; i < this.project.processNodes.length; i++) {
            var rect = SVG.get(this.project.processNodes[i].id)
            rect.attr({
                width: this.size,
                height: 50 / 100 * this.size
            })
        }
    }

    //================================================================
    //                    FORM CONTROL FUNCTIONS
    //================================================================
    /**
     * Add a input form group
     */
    addInput(list: FormArray) {
        switch (list) {
            case this.materialList:
                this.materialList.push(this.fb.group(this.transformForFormBuilder(new MaterialInput())));
                break;
            case this.energyList:
                this.energyList.push(this.fb.group(new EnergyInput()));
                break;
            case this.transportList:
                this.transportList.push(this.fb.group(new TransportationInput()));
                break;
            case this.outputList:
                this.outputList.push(this.fb.group(this.transformForFormBuilder(new Output())));
                break;
            case this.byproductList:
                this.byproductList.push(this.fb.group(new Byproduct()));
                break;
            case this.emissionList:
                this.emissionList.push(this.fb.group(new DirectEmission()));
                break;
        }
    }

    // remove input from group
    removeInput(list: FormArray, index: number) {
        list.removeAt(index);
    }

    // get the formgroup under inputs form array
    getInputsFormGroup(list: FormArray, index: number): FormGroup {
        const formGroup = list.controls[index] as FormGroup;
        return formGroup;
    }

    clearFormArray (formArray: FormArray) {
        while (formArray.length !== 0) {
            formArray.removeAt(0);
        }
    }

    //================================================================
    //                  MISCELLANEOUS FUNCTIONS
    //================================================================

    /**Read project data from dataService and update the form */
    readJSON(data) {
        var projectData = JSON.parse(data);
        this.project.parseData(projectData);
    }
    /** Default function to call when form is submitted */
    onSubmit() { }

    /** Save the project file to a directory of the user's choice */
    saveElsewhere() {
        var jsonContent = this.getJsonData();
        var filename = this.project.projectName;
        this.dataService.saveElsewhere(filename, jsonContent);
        this.fillLastSavedHTML();
    }

    /**Get the project details in stringified JSON format*/
    getJsonData() {
        return this.project.toString();
    }

    /**Record the current time, and show it when a project is saved */
    fillLastSavedHTML() {
        var milliseconds = new Date().getHours() + ':' + new Date().getMinutes();
        var ampm = (new Date().getHours() >= 12) ? "PM" : "AM";
        this.lastSaved = "Last saved " + milliseconds + ampm + ' ';
    }

    /**
     * Show warning when there are no process nodes allocated
     */
    showNoProcessWarning() {
        const dialogConfig = new MatDialogConfig();
        dialogConfig.disableClose = true;
        dialogConfig.autoFocus = true;
        dialogConfig.data = {
            id: 1,
            text: 'You cannot proceed or save without any allocated process.\n\
                    \nDouble click on a column to create a process in that stage,\
                    \nor re-allocate a process from the "Unallocated processes" sidebar.'
        };
        const dialogRef = this.dialog.open(Dialog, dialogConfig);
        dialogRef.afterClosed().subscribe(result => {
            console.log(' Dialog was closed')
        });
    }

    editMode() {
        if (this.isEdit) {
            this.isEdit = false;
        } else {
            this.isEdit = true;
        }
    }
    /**Save the current project to session storage, and navigate to the previous page */
    navPrev() {
        var jsonContent = this.getJsonData();
        this.dataService.setSessionStorage('currentProject', jsonContent);
        this.router.navigate(['/createProject']);
        this.pushToCookie();
    }

    /**Save the current project to session storage, and navigate to the next page */
    navNext() {
        if (this.project.processNodes.length == 0) {
            this.showNoProcessWarning();
        } else {
            var jsonContent = this.getJsonData();
            this.dataService.setSessionStorage('currentProject', jsonContent);
            this.router.navigate(['/result']);
            this.pushToCookie();
        }
    }

    navHome() {
        var jsonContent = this.project.toString();
        this.dataService.setSessionStorage('currentProject', jsonContent);
        this.router.navigate(['/mainMenu']);
        this.pushToCookie();
    }

    displayPromptNode() {
        if (this.isDisplayPrompt) {
            this.isDisplayPrompt = false;
            //remove all prompt nodes 
            this.removeAllPromptRect();
        } else {
            this.isDisplayPrompt = true;
            for (let i = 0; i < this.project.processNodes.length; i++) {
                let rectObj = this.project.processNodes[i];
                this.creatingPromptRect(rectObj, i, true);
            }
        }
    }

    /**
     * push data up to cookies
     * */
    pushToCookie() {
        let recentProject: Project[] = JSON.parse(this.cookies.get('recent'));
        for (let i = 0; i < recentProject.length; i++) {
            if (recentProject[i].projectName == this.project.projectName) {
                recentProject[i] = this.project;
                this.cookies.set('recent', JSON.stringify(recentProject, null, 2));
                return;
            }
        }
        recentProject.push(this.project);
        this.cookies.set('recent', JSON.stringify(recentProject, null, 2));
    }

    //================================================================
    //                    UNDO-REDO FUNCTIONS
    //================================================================
    /**
     * Save the state of the current project, in preparation for an undoable action
     */
    prepareForUndoableAction() {
        var mostRecentUndoableProj: Project;
        mostRecentUndoableProj = this.dataService.peekLastUndoable();
        if (this.project.equals(mostRecentUndoableProj)) {
            return;
        }
        this.dataService.addUndo(this.project);
    }

    /**
     * Invoke undo function from dataService, and update the display data accordingly
     */
    undo() {
        var result = this.dataService.undo(this.project);
        window.clearTimeout(this.waitId);
        //wait for resize to be over
        this.waitId = setTimeout(() => {
            this.doneResize();
        }, 100);
        if (!result) {
            return;
        }
        if (this.project == undefined || this.project == null) {
            return;
        }
        this.project = this.dataService.getProject();
        this.getDetails();
        this.cd.detectChanges();
        
    }

    /**
     * Invoke redo function from dataService, and update the display data accordingly
     */
    redo() {
        var result = this.dataService.redo(this.project);
        window.clearTimeout(this.waitId);
        //wait for resize to be over
        this.waitId = setTimeout(() => {
            this.doneResize();
        }, 100);
        if (!result) {
            return;
        }
        if (this.project == undefined || this.project == null) {
            return;
        }
        this.project = this.dataService.getProject();
        this.getDetails();
        this.cd.detectChanges();
    }

    debugClone(obj) {
        if (obj instanceof Array) {
            var result = [];
            for (let item of obj) {
                result.push(this.debugClone(item));
            }
            return result;
        } else if (obj instanceof Object) {
            return JSON.parse(JSON.stringify(obj));
        } else {
            return obj;
        }
    }

    debugLog(obj) {
        console.log(obj);
    }

    /**
     * "Screen capture" the process flow,
     * then pass it to the dataService, ready to be exported into pdf
     */
    exportPDF() {
        //Find the element with id 'exporttDiv', screen capture it, then pass the image data to a promise
        let imageHeight = 0;
        let imageWidth = 0;
        const promise = new Promise(function (resolve, reject) {
                html2canvas(document.getElementById('exportDiv'), {
                    allowTaint: true,
                    logging: false
                }).then(function (canvas) {
                    imageHeight = canvas.height;
                    imageWidth = canvas.width;
                    resolve(canvas.toDataURL('image/jpeg', 1.0));
                }).catch(function (error) {
                    console.log(error);
                });
        });
        //Pass the image data to dataService, then export it
        promise.then(dataURL => {
            this.dataService.addImage(dataURL, imageWidth, imageHeight, true);
            this.dataService.exportPDF();
        });
    }
}